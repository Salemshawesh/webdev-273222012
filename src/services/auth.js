const { randomBytes, scryptSync, timingSafeEqual, createHash } = require('node:crypto');
const { AppError } = require('./errors');
const digest = value => createHash('sha256').update(value).digest('hex');
function createAuthService(data) {
    const publicUser = user => ({ id: user.id, email: user.email, role: user.role });
    function emailAddress(value) {
        if (typeof value !== 'string' || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new AppError(422, 'Enter a valid email address.');
        return value.trim().toLowerCase();
    }
    function validPassword(password) {
        if (typeof password !== 'string' || password.length < 10 || password.length > 128) throw new AppError(422, 'Use a password between 10 and 128 characters.');
    }
    async function register(email, password) {
        email = emailAddress(email);
        validPassword(password);
        if (await data.findUser(email)) throw new AppError(409, 'This email is already registered.');
        const salt = randomBytes(16).toString('hex');
        const hash = salt + ':' + scryptSync(password, salt, 64).toString('hex');
        try { return publicUser(await data.addUser(email, hash)); }
        catch (error) {
            if (await data.findUser(email)) throw new AppError(409, 'This email is already registered.');
            throw error;
        }
    }
    async function newSession(user) {
        const token = randomBytes(32).toString('hex');
        await data.saveSession(digest(token), user.id, new Date(Date.now() + 7 * 86400000).toISOString());
        return { token, user: publicUser(user) };
    }
    async function login(email, password) {
        email = emailAddress(email);
        validPassword(password);
        const user = await data.findUser(email);
        // Do the expensive hash even for an unknown account.
        const stored = user?.password_hash || '00000000000000000000000000000000:' + '0'.repeat(128);
        const [salt, expected] = stored.split(':');
        if (!timingSafeEqual(scryptSync(password, salt, 64), Buffer.from(expected, 'hex'))) throw new AppError(401, 'Email or password is incorrect.');
        return newSession(user);
    }
    async function sessionUser(token) {
        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null;
        return (await data.sessionUser(digest(token), new Date().toISOString())) || null;
    }
    async function logout(token) {
        if (typeof token === 'string') await data.deleteSession(digest(token));
    }
    async function googleLogin(identity) {
        if (identity.email_verified !== true || typeof identity.sub !== 'string' || !identity.sub) throw new AppError(401, 'Google must verify your email.');
        const email = emailAddress(identity.email);
        let user = await data.findGoogle(identity.sub);
        if (!user) {
            user = await data.findUser(email);
            if (user) {
                if (user.google_sub && user.google_sub !== identity.sub) throw new AppError(409, 'This account is linked to a different Google identity.');
                await data.linkGoogle(user.id, identity.sub);
            } else user = await data.addUser(email, null, identity.sub);
        }
        return newSession(user);
    }
    return { register, login, sessionUser, logout, googleLogin };
}
module.exports = { createAuthService, digest };
