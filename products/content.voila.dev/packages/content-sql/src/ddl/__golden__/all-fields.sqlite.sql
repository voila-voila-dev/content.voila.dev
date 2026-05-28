create table "all_fields" (
  "id" text primary key not null,
  "created_at" integer not null default (unixepoch() * 1000),
  "updated_at" integer not null default (unixepoch() * 1000),
  "deleted_at" integer,
  "str" text,
  "str_required" text not null,
  "str_unique" text unique,
  "num" real,
  "int" integer,
  "flag" integer,
  "day" text,
  "moment" integer,
  "payload" text,
  "status" text,
  "path" text unique,
  "score" integer
);
create index "all_fields_score_idx" on "all_fields" ("score");

create table "site" (
  "id" text primary key not null,
  "created_at" integer not null default (unixepoch() * 1000),
  "updated_at" integer not null default (unixepoch() * 1000),
  "deleted_at" integer,
  "title" text not null,
  constraint "site_singleton" check (id = 'site')
);
