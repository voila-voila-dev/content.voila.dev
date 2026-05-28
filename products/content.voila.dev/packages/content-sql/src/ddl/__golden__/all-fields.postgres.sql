create table "all_fields" (
  "id" text primary key not null,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "deleted_at" timestamp with time zone,
  "str" text,
  "str_required" text not null,
  "str_unique" text unique,
  "num" real,
  "int" integer,
  "flag" boolean,
  "day" date,
  "moment" timestamp with time zone,
  "payload" jsonb,
  "status" text,
  "path" text unique,
  "score" integer
);
create index "all_fields_score_idx" on "all_fields" ("score");

create table "site" (
  "id" text primary key not null,
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "deleted_at" timestamp with time zone,
  "title" text not null,
  constraint "site_singleton" check (id = 'site')
);
