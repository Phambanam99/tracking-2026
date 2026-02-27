DO
$$
DECLARE
    private_key_type TEXT;
    public_key_type TEXT;
BEGIN
    SELECT udt_name
    INTO private_key_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jwt_signing_keys'
      AND column_name = 'private_key_der_base64';

    IF private_key_type = 'oid' THEN
        ALTER TABLE jwt_signing_keys ADD COLUMN private_key_der_base64_text TEXT;
        UPDATE jwt_signing_keys
        SET private_key_der_base64_text = convert_from(lo_get(private_key_der_base64), 'UTF8');
        ALTER TABLE jwt_signing_keys DROP COLUMN private_key_der_base64;
        ALTER TABLE jwt_signing_keys RENAME COLUMN private_key_der_base64_text TO private_key_der_base64;
    END IF;

    SELECT udt_name
    INTO public_key_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jwt_signing_keys'
      AND column_name = 'public_key_der_base64';

    IF public_key_type = 'oid' THEN
        ALTER TABLE jwt_signing_keys ADD COLUMN public_key_der_base64_text TEXT;
        UPDATE jwt_signing_keys
        SET public_key_der_base64_text = convert_from(lo_get(public_key_der_base64), 'UTF8');
        ALTER TABLE jwt_signing_keys DROP COLUMN public_key_der_base64;
        ALTER TABLE jwt_signing_keys RENAME COLUMN public_key_der_base64_text TO public_key_der_base64;
    END IF;
END
$$;

ALTER TABLE jwt_signing_keys
    ALTER COLUMN private_key_der_base64 TYPE TEXT,
    ALTER COLUMN public_key_der_base64 TYPE TEXT;

ALTER TABLE jwt_signing_keys
    ALTER COLUMN private_key_der_base64 SET NOT NULL,
    ALTER COLUMN public_key_der_base64 SET NOT NULL;
