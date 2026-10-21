-- ============================================================
-- 008 — OPTIONAL seed: Greek transport companies
-- ============================================================
-- OPTIONAL. Inserts ~18 realistic Greek transport companies as REAL Supabase
-- rows (transporters.is_seed = TRUE) so the Μεταφορές section is populated.
--
-- IMPORTANT — schema compatibility:
--   profiles.id REFERENCES auth.users(id), and an on_auth_user_created trigger
--   auto-creates the matching profile (with email + full_name) whenever a row is
--   inserted into auth.users. profiles.email is NOT NULL. Therefore this seed
--   creates auth.users rows FIRST (each with a unique @seed.agroexchange.local
--   email), lets the trigger create the profile, then enriches the profile and
--   inserts the transporter — exactly mirroring real user creation in the app.
--
-- To remove later:
--   DELETE FROM auth.users
--   WHERE email LIKE '%@seed.agroexchange.local';   -- cascades to profiles + transporters
-- ============================================================

DO $$
DECLARE
  companies JSONB := '[
    {"name":"Μεταφορική Θεσσαλίας ΑΕ","areas":["Λάρισα","Βόλος","Τρίκαλα","Καρδίτσα"],"cargo":["Χύδην","Παλέτες","Ξηρό φορτίο"],"vehicles":["Νταλίκα","Φορτηγό 10t"],"cap":24,"exp":18,"ver":true,"ins":true,"adr":false,"trips":340,"rating":4.7},
    {"name":"AgroTrans Μακεδονίας","areas":["Θεσσαλονίκη","Σέρρες","Κιλκίς","Πέλλα"],"cargo":["Δημητριακά","Χύδην","Λιπάσματα"],"vehicles":["Νταλίκα","Σιλοφόρο"],"cap":30,"exp":22,"ver":true,"ins":true,"adr":true,"trips":512,"rating":4.8},
    {"name":"Κρητικές Μεταφορές","areas":["Ηράκλειο","Χανιά","Ρέθυμνο"],"cargo":["Ελαιόλαδο","Φρούτα","Λαχανικά"],"vehicles":["Φορτηγό ψυγείο","Φορτηγό 8t"],"cap":18,"exp":15,"ver":true,"ins":true,"adr":false,"trips":278,"rating":4.6},
    {"name":"Πελοπόννησος Logistics","areas":["Πάτρα","Καλαμάτα","Κόρινθος","Τρίπολη"],"cargo":["Εσπεριδοειδή","Παλέτες","Χύδην"],"vehicles":["Νταλίκα","Φορτηγό ψυγείο"],"cap":26,"exp":12,"ver":true,"ins":false,"adr":false,"trips":195,"rating":4.4},
    {"name":"Ήπειρος Μεταφορική","areas":["Ιωάννινα","Άρτα","Πρέβεζα"],"cargo":["Γαλακτοκομικά","Ψυγείο","Χύδην"],"vehicles":["Φορτηγό ψυγείο"],"cap":16,"exp":9,"ver":false,"ins":true,"adr":false,"trips":120,"rating":4.2},
    {"name":"Θράκη Trans","areas":["Αλεξανδρούπολη","Κομοτηνή","Ξάνθη"],"cargo":["Δημητριακά","Βαμβάκι","Χύδην"],"vehicles":["Σιλοφόρο","Νταλίκα"],"cap":28,"exp":20,"ver":true,"ins":true,"adr":true,"trips":401,"rating":4.7},
    {"name":"Αττική Cargo","areas":["Αθήνα","Πειραιάς","Ελευσίνα"],"cargo":["Παλέτες","Ξηρό φορτίο","Containers"],"vehicles":["Νταλίκα","Φορτηγό 12t"],"cap":32,"exp":25,"ver":true,"ins":true,"adr":false,"trips":620,"rating":4.9},
    {"name":"Στερεά Μεταφορές","areas":["Λαμία","Χαλκίδα","Θήβα"],"cargo":["Χύδην","Παλέτες"],"vehicles":["Φορτηγό 10t"],"cap":20,"exp":11,"ver":false,"ins":false,"adr":false,"trips":88,"rating":4.0},
    {"name":"Δυτική Ελλάς Transport","areas":["Αγρίνιο","Μεσολόγγι","Πύργος"],"cargo":["Ελαιόλαδο","Καπνός","Χύδην"],"vehicles":["Νταλίκα","Βυτιοφόρο"],"cap":27,"exp":16,"ver":true,"ins":true,"adr":true,"trips":233,"rating":4.5},
    {"name":"Νησιωτική Μεταφορική","areas":["Σύρος","Νάξος","Πάρος","Μύκονος"],"cargo":["Παλέτες","Ψυγείο"],"vehicles":["Φορτηγό 8t","Φορτηγό ψυγείο"],"cap":14,"exp":8,"ver":false,"ins":true,"adr":false,"trips":76,"rating":4.1},
    {"name":"Μεσσηνία Agro Cargo","areas":["Καλαμάτα","Μεσσήνη","Πύλος"],"cargo":["Ελαιόλαδο","Σύκα","Χύδην"],"vehicles":["Νταλίκα","Φορτηγό ψυγείο"],"cap":22,"exp":14,"ver":true,"ins":true,"adr":false,"trips":188,"rating":4.6},
    {"name":"Βόρειο Αιγαίο Logistics","areas":["Μυτιλήνη","Χίος","Σάμος"],"cargo":["Ελαιόλαδο","Παλέτες"],"vehicles":["Φορτηγό 8t"],"cap":12,"exp":7,"ver":false,"ins":false,"adr":false,"trips":54,"rating":3.9},
    {"name":"Κεντρική Μακεδονία Trans","areas":["Θεσσαλονίκη","Βέροια","Νάουσα","Έδεσσα"],"cargo":["Φρούτα","Ροδάκινα","Ψυγείο"],"vehicles":["Φορτηγό ψυγείο","Νταλίκα"],"cap":29,"exp":19,"ver":true,"ins":true,"adr":false,"trips":367,"rating":4.7},
    {"name":"Εύβοια Μεταφορές","areas":["Χαλκίδα","Κύμη","Αλιβέρι"],"cargo":["Χύδην","Παλέτες","Λιπάσματα"],"vehicles":["Φορτηγό 10t","Νταλίκα"],"cap":21,"exp":13,"ver":true,"ins":false,"adr":false,"trips":142,"rating":4.3},
    {"name":"Κοζάνη Agro Transport","areas":["Κοζάνη","Πτολεμαΐδα","Γρεβενά","Καστοριά"],"cargo":["Δημητριακά","Όσπρια","Χύδην"],"vehicles":["Σιλοφόρο","Νταλίκα"],"cap":31,"exp":21,"ver":true,"ins":true,"adr":true,"trips":444,"rating":4.8},
    {"name":"Φθιώτιδα Cargo","areas":["Λαμία","Αταλάντη","Δομοκός"],"cargo":["Βαμβάκι","Δημητριακά","Χύδην"],"vehicles":["Νταλίκα"],"cap":25,"exp":10,"ver":false,"ins":true,"adr":false,"trips":97,"rating":4.2},
    {"name":"Ρόδος Island Trans","areas":["Ρόδος","Κως"],"cargo":["Παλέτες","Ψυγείο","Φρούτα"],"vehicles":["Φορτηγό ψυγείο","Φορτηγό 8t"],"cap":15,"exp":9,"ver":true,"ins":true,"adr":false,"trips":110,"rating":4.4},
    {"name":"Σερρών Μεταφορική ΑΕ","areas":["Σέρρες","Δράμα","Καβάλα"],"cargo":["Ρύζι","Καλαμπόκι","Χύδην"],"vehicles":["Σιλοφόρο","Νταλίκα","Φορτηγό 12t"],"cap":33,"exp":24,"ver":true,"ins":true,"adr":true,"trips":538,"rating":4.9}
  ]'::JSONB;
  c JSONB;
  seed_uid UUID;
  seed_email TEXT;
  idx INT := 0;
BEGIN
  FOR c IN SELECT * FROM jsonb_array_elements(companies)
  LOOP
    idx := idx + 1;
    -- Deterministic UUID + email per seed company (stable across re-runs).
    seed_uid   := uuid_generate_v5(uuid_ns_url(), 'agroexchange-seed-transporter-' || idx);
    seed_email := 'transporter' || idx || '@seed.agroexchange.local';

    -- 1) Create the auth.users row FIRST. The on_auth_user_created trigger then
    --    auto-inserts the matching profiles row (id, email, full_name) — so we
    --    never violate the email NOT NULL constraint or the auth.users FK.
    --    Several auth.users text columns are NOT NULL in many Supabase versions;
    --    we set them to '' to stay compatible without changing the schema.
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      created_at, updated_at
    )
    VALUES (
      seed_uid,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated', seed_email,
      '',                       -- no password (seed accounts are not meant to log in)
      NOW(),
      '{"provider":"seed","providers":["seed"]}'::JSONB,
      jsonb_build_object('full_name', c->>'name', 'role', 'transporter'),
      '', '', '', '',           -- non-null token columns
      NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2) Enrich the auto-created profile (role + verified + name).
    UPDATE public.profiles
    SET full_name = c->>'name',
        role      = 'transporter',
        verified  = (c->>'ver')::BOOLEAN
    WHERE id = seed_uid;

    -- 3) Insert the transporter row (real DB data, flagged is_seed = TRUE).
    INSERT INTO public.transporters (
      user_id, company_name, vehicle_type, capacity_tons, from_location, to_location,
      price_per_trip, available, rating, rating_count, total_trips,
      service_areas, cargo_types, vehicles, years_experience,
      verified, insured, adr_certified, is_seed
    )
    VALUES (
      seed_uid,
      c->>'name',
      COALESCE(jsonb_array_element_text(c->'vehicles', 0), 'Φορτηγό'),
      (c->>'cap')::NUMERIC,
      COALESCE(jsonb_array_element_text(c->'areas', 0), ''),
      COALESCE(jsonb_array_element_text(c->'areas', 1), ''),
      0, TRUE,
      (c->>'rating')::NUMERIC,
      0,
      (c->>'trips')::INT,
      ARRAY(SELECT jsonb_array_elements_text(c->'areas')),
      ARRAY(SELECT jsonb_array_elements_text(c->'cargo')),
      ARRAY(SELECT jsonb_array_elements_text(c->'vehicles')),
      (c->>'exp')::INT,
      (c->>'ver')::BOOLEAN,
      (c->>'ins')::BOOLEAN,
      (c->>'adr')::BOOLEAN,
      TRUE
    )
    ON CONFLICT (user_id) DO UPDATE SET
      company_name  = EXCLUDED.company_name,
      service_areas = EXCLUDED.service_areas,
      cargo_types   = EXCLUDED.cargo_types,
      vehicles      = EXCLUDED.vehicles,
      is_seed       = TRUE;
  END LOOP;
END $$;
