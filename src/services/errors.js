class AppError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'AppError';
        this.status = status;
    }
}
function requireUser(user) {
    if (!user) throw new AppError(401, 'Please sign in.');
}
module.exports = { AppError, requireUser };
