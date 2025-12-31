import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt';
import { UserRepository } from '../repositories/users';
import { JWT_CONFIG } from './constants';

const userRepo = new UserRepository();

// Configure local strategy for username/password authentication
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        // Find the user by email
        const user = await userRepo.findByEmail(email);
        
        // If user not found or password doesn't match
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        // Verify password
        const isValidPassword = await userRepo.verifyPassword(password, user.password);
        if (!isValidPassword) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        // Return the user without the password
        const { password: _, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Configure JWT strategy for token authentication
const jwtSecret = JWT_CONFIG.SECRET || JWT_CONFIG.FALLBACK_SECRET;

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret,
    },
    async (jwtPayload, done) => {
      try {
        // Find the user by email from JWT payload
        const user = await userRepo.findByEmail(jwtPayload.email);
        
        if (!user) {
          return done(null, false);
        }
        
        // Return the user without the password
        const { password: _, ...userWithoutPassword } = user;
        return done(null, userWithoutPassword);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

export default passport; 