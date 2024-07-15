const sendPasswordResetEmail = require('../utils/email');

exports.forgotPassword = asyncErrorHandler(async (req, res, next) => {
    // GER USER BASED ON POSTED EMAIL
    const user = await User.findOne({email: req.body.email});

    if (!user){
        const error = new CustomError('We could not find the user with given email', 404);
        next(error);
    }

    // GENERATE A RANDOM RESET TOKEN
    const resetToken = user.createResetPassowrdToken();

    await user.save({validateBeforeSave: false})

    // SEND THE TOKEN BACK TO THE USER EMAIL
    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
    const messsage = `We have received as password reset request. Please use the below link to reset your password\n\n${resetUrl}\n\nThis reset password link will be valid for only 10 minutes.`
    
    try{
        await sendPasswordResetEmail({
            email: user.email,
            subject: 'Password change request received',
            message: message
        });

        res.status(200).json({
            status: 'success',
            message: 'password reset link sent to the user email'
        })
    }catch(err){
        user.passwordResetToken = undefined;
        user.passwordResetToken = undefined;
        user.save({validateBeforeSave: False});

        return next(new CustomError('There was an error sending password reset email. Please try again later.', 500))
    }



});

exports.resetPassword = (req, res, next) => {

}