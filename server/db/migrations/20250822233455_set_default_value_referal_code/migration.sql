/*
  Warnings:

  - You are about to alter the column `referral_code` on the `users` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(8)`.

*/
CREATE OR REPLACE FUNCTION generate_unique_referral_code() 
RETURNS VARCHAR(8) AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ123456789';
    result TEXT;
    attempts INTEGER := 0;
BEGIN
    LOOP
        result := '';
        FOR i IN 1..8 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
        END LOOP;
      
        -- Ensure exactly 8 characters
        result := substr(result, 1, 8);

        -- Check if this code already exists
        IF NOT EXISTS (SELECT 1 FROM users WHERE "referral_code" = result) THEN
            RETURN result;
        END IF;
        
        attempts := attempts + 1;
        IF attempts > 100 THEN
            RAISE EXCEPTION 'Unable to generate unique referral code after 100 attempts';
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "referral_code" SET DEFAULT generate_unique_referral_code(),
ALTER COLUMN "referral_code" SET DATA TYPE VARCHAR(8);
