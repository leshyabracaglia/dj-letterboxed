CREATE TABLE "favorite_reviews" (
	"user_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_reviews_user_id_position_pk" PRIMARY KEY("user_id","position"),
	CONSTRAINT "favorite_reviews_user_id_review_id_unique" UNIQUE("user_id","review_id"),
	CONSTRAINT "favorite_reviews_position_check" CHECK ("position" BETWEEN 1 AND 3)
);
--> statement-breakpoint
ALTER TABLE "favorite_reviews" ADD CONSTRAINT "favorite_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "favorite_reviews" ADD CONSTRAINT "favorite_reviews_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
