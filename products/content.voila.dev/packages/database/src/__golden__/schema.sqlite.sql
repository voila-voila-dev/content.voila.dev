TABLE "all_fields" (
  "id" text PRIMARY KEY NOT NULL DEFAULT
  "created_at" integer NOT NULL DEFAULT
  "updated_at" integer NOT NULL DEFAULT
  "deleted_at" integer
  "str" text
  "str_required" text NOT NULL
  "str_unique" text UNIQUE
  "num" real
  "int" integer
  "flag" integer
  "day" text
  "moment" integer
  "payload" text
)

TABLE "site" (
  "id" text PRIMARY KEY NOT NULL DEFAULT
  "created_at" integer NOT NULL DEFAULT
  "updated_at" integer NOT NULL DEFAULT
  "deleted_at" integer
  "title" text NOT NULL
  CHECK site_singleton
)
