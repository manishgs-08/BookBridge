/**
 * Passport.js Google OAuth 2.0 Strategy
 *
 * Flow:
 * 1. User hits GET /api/auth/google
 * 2. Passport redirects to Google consent screen
 * 3. Google authenticates and redirects to callback URL
 * 4. This strategy extracts profile data
 * 5. findOrCreateUser inserts/updates the User record
 * 6. User object is passed to the route handler via req.user
 *
 * Note: We do NOT use Passport sessions (no serializeUser/deserializeUser).
 * Authentication is stateless via JWT after the OAuth callback.
 */

const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { pool } = require('./db');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
      // Request profile and email scopes
      scope: ['profile', 'email'],
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
        const emailVerified = profile.emails && profile.emails[0] ? profile.emails[0].verified : false;
        const userName = profile.displayName || '';
        const profilePicture = profile.photos && profile.photos[0] ? profile.photos[0].value : null;

        if (!email) {
          return done(new Error('No email address returned from Google'), null);
        }

        // Check if user already exists
        const [existingUsers] = await pool.query(
          'SELECT * FROM User WHERE google_id = ?',
          [googleId]
        );

        let user;

        if (existingUsers.length > 0) {
          // Existing user — update profile fields that may have changed
          user = existingUsers[0];

          await pool.query(
            `UPDATE User 
             SET user_name = ?, email = ?, email_verified = ?, profile_picture = ?, updated_at = CURRENT_TIMESTAMP
             WHERE user_id = ?`,
            [userName, email, emailVerified, profilePicture, user.user_id]
          );

          // Refresh user data after update
          const [updatedUsers] = await pool.query(
            'SELECT * FROM User WHERE user_id = ?',
            [user.user_id]
          );
          user = updatedUsers[0];
        } else {
          // New user — insert with default role 'buyer'
          const [result] = await pool.query(
            `INSERT INTO User (google_id, user_name, email, email_verified, profile_picture, role, seller_verified)
             VALUES (?, ?, ?, ?, ?, 'buyer', FALSE)`,
            [googleId, userName, email, emailVerified, profilePicture]
          );

          const [newUsers] = await pool.query(
            'SELECT * FROM User WHERE user_id = ?',
            [result.insertId]
          );
          user = newUsers[0];
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

module.exports = passport;
