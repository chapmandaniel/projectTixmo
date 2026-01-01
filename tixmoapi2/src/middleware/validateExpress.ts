import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { StatusCodes } from 'http-status-codes';

export const validate = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(StatusCodes.BAD_REQUEST).json({
            message: 'Validation failed',
            errors: errors.array()
        });
    }
    return next();
};
