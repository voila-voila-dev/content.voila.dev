TABLE "all_fields" (
  "id" text PRIMARY KEY NOT NULL DEFAULT
  "created_at" timestamp with time zone NOT NULL DEFAULT
  "updated_at" timestamp with time zone NOT NULL DEFAULT
  "deleted_at" timestamp with time zone
  "str" text
  "str_required" text NOT NULL
  "str_unique" text UNIQUE
  "num" real
  "int" integer
  "flag" boolean
  "day" date
  "moment" timestamp with time zone
  "payload" jsonb
)

TABLE "site" (
  "id" text PRIMARY KEY NOT NULL DEFAULT
  "created_at" timestamp with time zone NOT NULL DEFAULT
  "updated_at" timestamp with time zone NOT NULL DEFAULT
  "deleted_at" timestamp with time zone
  "title" text NOT NULL
  CHECK site_singleton
)
