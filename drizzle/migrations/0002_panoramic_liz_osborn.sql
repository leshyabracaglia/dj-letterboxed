CREATE TABLE "review_tags" (
	"review_id" uuid NOT NULL,
	"tagged_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_tags_review_id_tagged_user_id_pk" PRIMARY KEY("review_id","tagged_user_id")
);
--> statement-breakpoint
ALTER TABLE "djs" ADD COLUMN "spotify_id" varchar(64);--> statement-breakpoint
ALTER TABLE "review_tags" ADD CONSTRAINT "review_tags_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_tags" ADD CONSTRAINT "review_tags_tagged_user_id_users_id_fk" FOREIGN KEY ("tagged_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "djs" ADD CONSTRAINT "djs_spotify_id_unique" UNIQUE("spotify_id");