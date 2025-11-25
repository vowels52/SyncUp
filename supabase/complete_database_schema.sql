-- OnSpace Cloud - SyncUp Database Schema
-- Generated from OnSpace.AI schema on 2025-11-05
-- Updated: 2025-11-11 - Added Find Your Match feature tables
-- Supabase-compatible SQL

-- =====================================================
-- TABLE: user_profiles
-- Description: Extended user profile information for authenticated users
-- =====================================================

CREATE TABLE IF NOT EXISTS user_profiles (
    id uuid PRIMARY KEY,
    username text,
    email text NOT NULL,
    full_name text,
    major text,
    year text,
    bio text,
    study_habits text,
    skills text[],
    profile_image_url text,
    university text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Authenticated users can view all profiles" ON user_profiles
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Users can delete own profile" ON user_profiles
    FOR DELETE
    USING (auth.uid() = id);

-- =====================================================
-- TABLE: interests
-- Description: Available interests that users can select
-- =====================================================

CREATE TABLE IF NOT EXISTS interests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE interests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for interests
CREATE POLICY "anon_select_interests" ON interests
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "authenticated_select_interests" ON interests
    FOR SELECT
    TO authenticated
    USING (true);

-- =====================================================
-- TABLE: user_interests
-- Description: Junction table linking users to their interests
-- =====================================================

CREATE TABLE IF NOT EXISTS user_interests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    interest_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, interest_id),
    CONSTRAINT user_interests_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    CONSTRAINT user_interests_interest_id_fkey FOREIGN KEY (interest_id) REFERENCES interests(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_interests
CREATE POLICY "authenticated_select_user_interests" ON user_interests
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_own_interests" ON user_interests
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "authenticated_delete_own_interests" ON user_interests
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- =====================================================
-- TABLE: courses
-- Description: Available university courses
-- =====================================================

CREATE TABLE IF NOT EXISTS courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    code text NOT NULL UNIQUE,
    created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for courses
CREATE POLICY "anon_select_courses" ON courses
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "authenticated_select_courses" ON courses
    FOR SELECT
    TO authenticated
    USING (true);

-- =====================================================
-- TABLE: user_courses
-- Description: Junction table linking users to their enrolled courses
-- =====================================================

CREATE TABLE IF NOT EXISTS user_courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, course_id),
    CONSTRAINT user_courses_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    CONSTRAINT user_courses_course_id_fkey FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE user_courses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_courses
CREATE POLICY "authenticated_select_user_courses" ON user_courses
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_own_courses" ON user_courses
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "authenticated_delete_own_courses" ON user_courses
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- =====================================================
-- TABLE: groups
-- Description: Study groups and student organizations
-- =====================================================

CREATE TABLE IF NOT EXISTS groups (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    creator_id uuid NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT groups_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groups
CREATE POLICY "authenticated_select_groups" ON groups
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_groups" ON groups
    FOR INSERT
    TO authenticated
    WITH CHECK (creator_id = auth.uid());

CREATE POLICY "authenticated_update_own_groups" ON groups
    FOR UPDATE
    TO authenticated
    USING (creator_id = auth.uid());

CREATE POLICY "authenticated_delete_own_groups" ON groups
    FOR DELETE
    TO authenticated
    USING (creator_id = auth.uid());

-- =====================================================
-- TABLE: group_members
-- Description: Junction table for group membership
-- =====================================================

CREATE TABLE IF NOT EXISTS group_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'member')),
    joined_at timestamp with time zone DEFAULT now(),
    UNIQUE(group_id, user_id),
    CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for group_members
CREATE POLICY "authenticated_select_group_members" ON group_members
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_group_members" ON group_members
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (SELECT 1 FROM groups WHERE id = group_id AND creator_id = auth.uid()) 
        OR user_id = auth.uid()
    );

CREATE POLICY "authenticated_delete_group_members" ON group_members
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid() 
        OR EXISTS (SELECT 1 FROM groups WHERE id = group_id AND creator_id = auth.uid())
    );

-- =====================================================
-- TABLE: events
-- Description: Campus events, study sessions, and meetings
-- =====================================================

CREATE TABLE IF NOT EXISTS events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    location text,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone,
    creator_id uuid NOT NULL,
    image_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT events_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for events
CREATE POLICY "authenticated_select_events" ON events
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_events" ON events
    FOR INSERT
    TO authenticated
    WITH CHECK (creator_id = auth.uid());

CREATE POLICY "authenticated_update_own_events" ON events
    FOR UPDATE
    TO authenticated
    USING (creator_id = auth.uid());

CREATE POLICY "authenticated_delete_own_events" ON events
    FOR DELETE
    TO authenticated
    USING (creator_id = auth.uid());

-- =====================================================
-- TABLE: event_attendees
-- Description: Junction table for event attendance and RSVP status
-- =====================================================

CREATE TABLE IF NOT EXISTS event_attendees (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('going', 'interested', 'not_going')),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(event_id, user_id),
    CONSTRAINT event_attendees_event_id_fkey FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT event_attendees_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_attendees
CREATE POLICY "authenticated_select_event_attendees" ON event_attendees
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "authenticated_insert_event_attendees" ON event_attendees
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "authenticated_update_own_attendance" ON event_attendees
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "authenticated_delete_own_attendance" ON event_attendees
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- =====================================================
-- FORUM TABLES
-- Description: Community forum for discussions, questions, and knowledge sharing
-- =====================================================

-- Forum Posts Table
CREATE TABLE IF NOT EXISTS forum_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id uuid NOT NULL,
    title text NOT NULL,
    content text,
    category text CHECK (category IN ('courses', 'study-tips', 'professors', 'all')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT forum_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- Forum Comments Table
CREATE TABLE IF NOT EXISTS forum_comments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL,
    author_id uuid NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT forum_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
    CONSTRAINT forum_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- Post Reactions (Likes) Table
CREATE TABLE IF NOT EXISTS post_reactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction_type text DEFAULT 'like' CHECK (reaction_type IN ('like', 'helpful', 'insightful')),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(post_id, user_id, reaction_type),
    CONSTRAINT post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
    CONSTRAINT post_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- Post Tags Table
CREATE TABLE IF NOT EXISTS post_tags (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id uuid NOT NULL,
    tag text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT post_tags_post_id_fkey FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_forum_posts_author ON forum_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(category);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_comments_post ON forum_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_forum_comments_author ON forum_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user ON post_reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_post ON post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag);

-- Enable RLS for forum tables
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for forum_posts
CREATE POLICY "Anyone can view posts" ON forum_posts
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create posts" ON forum_posts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own posts" ON forum_posts
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own posts" ON forum_posts
    FOR DELETE
    TO authenticated
    USING (auth.uid() = author_id);

-- RLS Policies for forum_comments
CREATE POLICY "Anyone can view comments" ON forum_comments
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create comments" ON forum_comments
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their own comments" ON forum_comments
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their own comments" ON forum_comments
    FOR DELETE
    TO authenticated
    USING (auth.uid() = author_id);

-- RLS Policies for post_reactions
CREATE POLICY "Anyone can view reactions" ON post_reactions
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can create reactions" ON post_reactions
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions" ON post_reactions
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- RLS Policies for post_tags
CREATE POLICY "Anyone can view tags" ON post_tags
    FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Post authors can manage tags" ON post_tags
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM forum_posts
            WHERE forum_posts.id = post_tags.post_id
            AND forum_posts.author_id = auth.uid()
        )
    );

-- =====================================================
-- FIND YOUR MATCH FEATURE TABLES
-- Description: Tables for user connections, match preferences, and match history
-- =====================================================

-- =====================================================
-- TABLE: connections
-- Description: Stores connection requests between users with status tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS connections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    connected_user_id uuid NOT NULL,
    status text NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, connected_user_id),
    CONSTRAINT connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    CONSTRAINT connections_connected_user_id_fkey FOREIGN KEY (connected_user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    CONSTRAINT connections_no_self_connection CHECK (user_id != connected_user_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_connections_user ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_connected_user ON connections(connected_user_id);
CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);
CREATE INDEX IF NOT EXISTS idx_connections_created ON connections(created_at DESC);

-- Enable RLS
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for connections
CREATE POLICY "Users can view their own connections" ON connections
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() OR connected_user_id = auth.uid());

CREATE POLICY "Users can create their own connections" ON connections
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own connections" ON connections
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid() OR connected_user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own connections" ON connections;

CREATE POLICY "Users can delete their own connections" ON connections
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid() OR connected_user_id = auth.uid());

-- =====================================================
-- TABLE: match_history
-- Description: Tracks user interactions to avoid showing same profiles repeatedly
-- =====================================================

CREATE TABLE IF NOT EXISTS match_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    viewed_user_id uuid NOT NULL,
    action text NOT NULL CHECK (action IN ('skip', 'connect')),
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, viewed_user_id),
    CONSTRAINT match_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    CONSTRAINT match_history_viewed_user_id_fkey FOREIGN KEY (viewed_user_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    CONSTRAINT match_history_no_self_view CHECK (user_id != viewed_user_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_match_history_user ON match_history(user_id);
CREATE INDEX IF NOT EXISTS idx_match_history_viewed_user ON match_history(viewed_user_id);
CREATE INDEX IF NOT EXISTS idx_match_history_action ON match_history(action);
CREATE INDEX IF NOT EXISTS idx_match_history_created ON match_history(created_at DESC);

-- Enable RLS
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for match_history
CREATE POLICY "Users can view their own match history" ON match_history
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own match history" ON match_history
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own match history" ON match_history
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- =====================================================
-- TABLE: user_match_preferences
-- Description: User preferences for finding matches (optional filtering)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_match_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE,
    preferred_majors text[],
    preferred_years text[],
    preferred_study_habits text,
    min_shared_interests integer DEFAULT 1,
    min_shared_courses integer DEFAULT 0,
    show_only_same_university boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_match_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- Index for user lookup
CREATE INDEX IF NOT EXISTS idx_user_match_preferences_user ON user_match_preferences(user_id);

-- Enable RLS
ALTER TABLE user_match_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_match_preferences
CREATE POLICY "Users can view their own match preferences" ON user_match_preferences
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can create their own match preferences" ON user_match_preferences
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own match preferences" ON user_match_preferences
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own match preferences" ON user_match_preferences
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- =====================================================
-- FUNCTION: handle_new_user
-- Description: Automatically creates user profile when new auth user is created
-- =====================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, created_at, updated_at)
    VALUES (NEW.id, NEW.email, now(), now());
    RETURN NEW;
END;
$$;

-- =====================================================
-- FUNCTION: update_updated_at_column
-- Description: Automatically updates updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- =====================================================
-- FUNCTION: get_potential_matches
-- Description: Returns potential matches for a user based on shared interests/courses
-- =====================================================

CREATE OR REPLACE FUNCTION get_potential_matches(
    target_user_id uuid,
    match_limit integer DEFAULT 10
)
RETURNS TABLE (
    user_id uuid,
    full_name text,
    major text,
    year text,
    bio text,
    shared_interests integer,
    shared_courses integer,
    match_score integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH user_interests AS (
        SELECT interest_id
        FROM user_interests
        WHERE user_interests.user_id = target_user_id
    ),
    user_courses AS (
        SELECT course_id
        FROM user_courses
        WHERE user_courses.user_id = target_user_id
    ),
    already_viewed AS (
        SELECT viewed_user_id
        FROM match_history
        WHERE match_history.user_id = target_user_id
    ),
    existing_connections AS (
        SELECT connected_user_id
        FROM connections
        WHERE connections.user_id = target_user_id
        UNION
        SELECT connections.user_id
        FROM connections
        WHERE connected_user_id = target_user_id
    )
    SELECT
        up.id,
        up.full_name,
        up.major,
        up.year,
        up.bio,
        COALESCE(
            (SELECT COUNT(*)::integer
             FROM user_interests ui
             WHERE ui.user_id = up.id
             AND ui.interest_id IN (SELECT interest_id FROM user_interests)),
            0
        ) as shared_interests,
        COALESCE(
            (SELECT COUNT(*)::integer
             FROM user_courses uc
             WHERE uc.user_id = up.id
             AND uc.course_id IN (SELECT course_id FROM user_courses)),
            0
        ) as shared_courses,
        (
            COALESCE(
                (SELECT COUNT(*)::integer
                 FROM user_interests ui
                 WHERE ui.user_id = up.id
                 AND ui.interest_id IN (SELECT interest_id FROM user_interests)),
                0
            ) * 2 +
            COALESCE(
                (SELECT COUNT(*)::integer
                 FROM user_courses uc
                 WHERE uc.user_id = up.id
                 AND uc.course_id IN (SELECT course_id FROM user_courses)),
                0
            ) * 3
        ) as match_score
    FROM user_profiles up
    WHERE up.id != target_user_id
    AND up.id NOT IN (SELECT viewed_user_id FROM already_viewed)
    AND up.id NOT IN (SELECT connected_user_id FROM existing_connections)
    AND up.full_name IS NOT NULL
    ORDER BY match_score DESC, RANDOM()
    LIMIT match_limit;
END;
$$;

-- =====================================================
-- FUNCTION: accept_connection
-- Description: Accepts a pending connection request
-- =====================================================

CREATE OR REPLACE FUNCTION accept_connection(
    connection_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
    connection_user_id uuid;
BEGIN
    current_user_id := auth.uid();

    -- Get the user_id from the connection
    SELECT connected_user_id INTO connection_user_id
    FROM connections
    WHERE id = connection_id
    AND connected_user_id = current_user_id
    AND status = 'pending';

    IF connection_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- Update the connection status
    UPDATE connections
    SET status = 'accepted', updated_at = now()
    WHERE id = connection_id;

    RETURN true;
END;
$$;

-- =====================================================
-- FUNCTION: reject_connection
-- Description: Rejects a pending connection request
-- =====================================================

CREATE OR REPLACE FUNCTION reject_connection(
    connection_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_user_id uuid;
    connection_user_id uuid;
BEGIN
    current_user_id := auth.uid();

    -- Get the user_id from the connection
    SELECT connected_user_id INTO connection_user_id
    FROM connections
    WHERE id = connection_id
    AND connected_user_id = current_user_id
    AND status = 'pending';

    IF connection_user_id IS NULL THEN
        RETURN false;
    END IF;

    -- Update the connection status
    UPDATE connections
    SET status = 'rejected', updated_at = now()
    WHERE id = connection_id;

    RETURN true;
END;
$$;

-- =====================================================
-- TRIGGER: on_auth_user_created
-- Description: Trigger that fires when a new user is created in auth.users
-- =====================================================

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- =====================================================
-- TRIGGERS: Auto-update updated_at for forum tables
-- =====================================================

CREATE TRIGGER update_forum_posts_updated_at
    BEFORE UPDATE ON forum_posts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forum_comments_updated_at
    BEFORE UPDATE ON forum_comments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGER: Auto-update updated_at for connections
-- =====================================================

CREATE TRIGGER update_connections_updated_at
    BEFORE UPDATE ON connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TRIGGER: Auto-update updated_at for user_match_preferences
-- =====================================================

CREATE TRIGGER update_user_match_preferences_updated_at
    BEFORE UPDATE ON user_match_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DEFAULT DATA: Interests
-- =====================================================

INSERT INTO interests (name) VALUES
    ('Computer Science'),
    ('Engineering'),
    ('Business'),
    ('Mathematics'),
    ('Physics'),
    ('Biology'),
    ('Psychology'),
    ('Art & Design'),
    ('Music'),
    ('Sports'),
    ('Entrepreneurship'),
    ('Research'),
    ('Photography'),
    ('Writing'),
    ('Public Speaking')
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- DEFAULT DATA: Courses
-- =====================================================

INSERT INTO courses (name, code) VALUES
    ('Introduction to Computer Science', 'CS101'),
    ('Data Structures & Algorithms', 'CS201'),
    ('Calculus I', 'MATH101'),
    ('Physics I', 'PHYS101'),
    ('Business Management', 'BUS101'),
    ('Psychology 101', 'PSY101'),
    ('English Composition', 'ENG101'),
    ('Biology I', 'BIO101')
ON CONFLICT (code) DO NOTHING;

-- =====================================================
-- MIGRATION: Add Official Clubs Support to Groups Table
-- Description: Adds fields to distinguish official UWB clubs from user-created groups
-- Source: Add1.txt
-- =====================================================

-- Add new columns to groups table
ALTER TABLE groups
  ADD COLUMN IF NOT EXISTS club_type text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS is_official_club boolean DEFAULT false;

-- Add index on is_official_club for faster queries
CREATE INDEX IF NOT EXISTS idx_groups_is_official_club ON groups(is_official_club);

-- Add index on club_type for filtering
CREATE INDEX IF NOT EXISTS idx_groups_club_type ON groups(club_type);

-- Add index on category for filtering
CREATE INDEX IF NOT EXISTS idx_groups_category ON groups(category);

-- Add index on external_id for lookups
CREATE INDEX IF NOT EXISTS idx_groups_external_id ON groups(external_id);

-- Update RLS policies to allow viewing official clubs
-- Official clubs should be viewable by all authenticated users
DROP POLICY IF EXISTS "authenticated_select_groups" ON groups;

CREATE POLICY "authenticated_select_groups" ON groups
    FOR SELECT
    TO authenticated
    USING (
        true  -- All authenticated users can view all groups (both user groups and official clubs)
    );

-- Official clubs cannot be updated or deleted by regular users
-- Migration: Insert UWB Official Clubs (v2 - Auto-detect system user)
-- Description: Inserts all official UWB clubs from gather.uwb.edu
-- Date: 2025-11-12
-- Generated from: data/uwb-clubs.json

-- This version automatically uses the first available user as creator
-- Or creates a system user if none exists

DO $$
DECLARE
    system_user_id uuid;
BEGIN
    -- Try to get an existing user
    SELECT id INTO system_user_id FROM user_profiles ORDER BY created_at LIMIT 1;

    -- If no users exist, this will fail - you need at least one user in your database
    IF system_user_id IS NULL THEN
        RAISE EXCEPTION 'No users found in user_profiles table. Please create at least one user account first.';
    END IF;

    -- Insert official UWB clubs using the found user ID
    INSERT INTO groups (
        name,
        description,
        creator_id,
        image_url,
        club_type,
        category,
        external_url,
        external_id,
        is_official_club,
        created_at,
        updated_at
    ) VALUES
        (
            'Activities & Recreation Center',
            'Mission The ARC Is a place for campus to connect through community and play.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2025/s2_image_upload_604841_ARC_Logo_416182354.png',
            'Department',
            'Social/Recreational',
            'https://gather.uwb.edu/student_community?club_id=35499',
            '35499',
            true,
            now(),
            now()
        ),
        (
            'ARC Fitness Center',
            'Mission Located on the Lower Level of the Activities & Recreation Center, the ARC Fitness Center features state-of-the-art equipment and machines for use by currently enrolled University of Washington Bothell and Cascadia College students, and faculty and staff from both institutions with the purchase of a Fitness Center Membership. Currently enrolled University of Washington Bothell and Cascadia College students do not need to purchase a membership. All eligible staff and faculty from the University of Washington Bothell and Cascadia College can purchase an ARC Fitness Center membership by visiting MyArc.uwb.edu. For membership inquiries, please contact Rebecca Kimble, rkimble@uw.edu. No guest passes will be available for purchase at this time.The Group Fitness program offers a wide variety of free, welcoming and inclusive fitness classes for all levels. All ARC Group Fitness Instructors provide a welcoming and inclusive environment where students, faculty, and staff have the opportunity to gather and participate in a variety of group fitness formats regardless of skill level and ability. There are a variety of Group Fitness classes available to attend including Yoga, Indoor Cycling, Strength & Conditioning, Pilates, Dance and more.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2025/s2_image_upload_604843_arc_fitness_logo_731155512.png',
            'Department',
            'Social/Recreational',
            'https://gather.uwb.edu/student_community?club_id=35556',
            '35556',
            true,
            now(),
            now()
        ),
        (
            'Intramural Activities',
            'Mission The focus of Intramural Activities at the Activities & Recreation Center (ARC) is to provide an environment where students, faculty and staff have the opportunity to gather and participate in various sport and leisure activities regardless of skill level and ability. We understand that sports and recreation can be an area not all folks have experience in, which is why we host programs and events that are not only free, but rooted in learning, playing, and connecting with the campus through sports and activities. From our Quarterly skill building and open play events to our structured weekly leagues, we aim to offer a program for everyone here on campus. There is always space for all students at all of our events. All currently enrolled and fee-paying students at both UW Bothell and Cascadia! Please remember to bring your student ID with you at check-in.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2025/s2_image_upload_604845_IMleagues_Profile_Picture_Updated_1_811171614.png',
            'Department',
            NULL,
            'https://gather.uwb.edu/student_community?club_id=35558',
            '35558',
            true,
            now(),
            now()
        ),
        (
            'Outdoor Wellness',
            'Mission The Outdoor Wellness (OW) program''s mission is to provide strategic and intentional programming designed to diminish barriers to entry for outdoor recreation, increase competency and mental fortitude, develop skills for responsible participation in outdoor activities and optimize health through the nine dimensions of wellness. We strive to develop deeper relationships and create a fun, inclusive and safe environment for students interested in recreating outdoors. If you are interested in any of our programs or want to learn more information, please email outdoor@uw.edu or click on the buttons below. You can also stop by the Nest Outdoor Gear Shop during our open hours to talk to an Outdoor Wellness Team member.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2025/s2_image_upload_604846_OWARC_logojpg_925154348.jpeg',
            'Department',
            NULL,
            'https://gather.uwb.edu/student_community?club_id=35559',
            '35559',
            true,
            now(),
            now()
        ),
        (
            'Advancement',
            'Mission',
            system_user_id,
            'https://gather.uwb.edu/images/default_club_logo_square.png',
            'Department',
            NULL,
            'https://gather.uwb.edu/student_community?club_id=35530',
            '35530',
            true,
            now(),
            now()
        ),
        (
            'Afghan Student Union',
            'It is the mission of the Afghan Student Union at the University of Washington Bothell to create a space where Afghan students are able to come together in order to engage with one another and celebrate our Afghan identity and culture. We plan on creating opportunities for the Afghan community on campus to come together through club meetings, events, lectures, and discussions. Overall, we''re here to cultivate a community and allow for better representation of the Afghan population both at UWB and within our broader communities.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_600235_IMG_9156_926151412.jpeg',
            'Registered Student Club',
            'Cultural Club',
            'https://gather.uwb.edu/student_community?club_id=35485',
            '35485',
            true,
            now(),
            now()
        ),
        (
            'Alliance 4 Sustainability',
            'Alliance 4 Sustainability (A4S) strives to be a space where everyone can collaborate and learn about what sustainability means to them. We serve as a bridge between students, staff, faculty, and the greater community to discuss and present about sustainability issues, as well as educate about sustainability (and how it could be implemented) with regards to campus and the global community.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599668_A4S_IG_PFP_Blank_Green_838138013.png',
            'Registered Student Club',
            'Special Interest',
            'https://gather.uwb.edu/student_community?club_id=35488',
            '35488',
            true,
            now(),
            now()
        ),
        (
            'Arab Student Association',
            'The Arab Student Association is a cultural club aimed at creating a safe space for all students interested in learning more about Arab culture. Through educational, cultural, social, charitable, and political activities, we strive to spread awareness of current issues in the Arab world while celebrating our unique cultures and commonalities.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599666_ASA_logo_793163738.png',
            'Registered Student Club',
            'Cultural Club',
            'https://gather.uwb.edu/student_community?club_id=35489',
            '35489',
            true,
            now(),
            now()
        ),
        (
            'ARC Fitness Center',
            '',
            system_user_id,
            'https://gather.uwb.edu/images/default_club_logo_square.png',
            'Registered Student Club',
            NULL,
            'https://gather.uwb.edu/student_community?club_id=35501',
            '35501',
            true,
            now(),
            now()
        ),
        (
            'ASME UWB',
            'ASME student chapter that is centered towards professional development and networking opportunities for students on the Bothell campus.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599675_ASME_logo_logo_only_325161310.png',
            'Registered Student Club',
            'Academic Club',
            'https://gather.uwb.edu/student_community?club_id=35502',
            '35502',
            true,
            now(),
            now()
        ),
        (
            'Associated Students of University of Washington Bothell',
            'Associated Students of the University of Washington Bothell is the officially recognized student government and the collective voice for the undergraduate students of UW Bothell. We are dedicated to ensuring all students have the resources to navigate their college careers and a system to voice their concerns at every turn. ASUWB is comprised of roughly forty undergraduate volunteers, led by an elected five-person executive board.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599670_ASUWB_Logo_Idea_2_863133010.png',
            'Student Organization',
            NULL,
            'https://gather.uwb.edu/student_community?club_id=35507',
            '35507',
            true,
            now(),
            now()
        ),
        (
            'Association for Computing Machinery',
            'Welcome to the Association for Computing Machinery (ACM) at UW Bothell! We are a student-led organization dedicated to fostering a strong and supportive community for all students interested in technology and computing. Whether you''re majoring in computer science, exploring other STEM fields, or simply curious about tech, ACM provides a welcoming space to connect with like-minded peers and grow your skills. Our mission is to offer educational opportunities and resources that enhance your academic and professional journey. We host events such as hackathons, coding competitions, and career fairs that provide hands-on experience and networking opportunities with industry professionals.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599672_acm_logo_594194715.png',
            'Registered Student Club',
            'Academic Club',
            'https://gather.uwb.edu/student_community?club_id=35503',
            '35503',
            true,
            now(),
            now()
        ),
        (
            'Association for Computing Machinery- Women''s',
            'ACM-W is an organization where we support, celebrate, and advocate for the full engagement of women in all aspects of the computing field, providing a wide range of programs and services to ACM members and working in the larger community to advance the contributions of technical women.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599674_ACM_W_logo_924181412.png',
            'Registered Student Club',
            'Academic Club',
            'https://gather.uwb.edu/student_community?club_id=35504',
            '35504',
            true,
            now(),
            now()
        ),
        (
            'Badminton Social Club',
            'The mission of Badminton Social Club at the University of Washington Bothell is to provide a welcoming and inclusive environment for students, faculty, and staff to engage in the sport of badminton, regardless of skill level. Our club aims to foster a sense of community, promote physical health, and encourage friendly competition through regular practice sessions, social events, and friendly matches. We are dedicated to offering opportunities for members to improve their badminton skills while building lasting friendships and connections within the UW Bothell community.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599676_Badminton_Social_Club_Logo_Idea_1_513183011.png',
            'Registered Student Club',
            'Social/Recreational',
            'https://gather.uwb.edu/student_community?club_id=35505',
            '35505',
            true,
            now(),
            now()
        ),
        (
            'Beta Alpha Psi Mu Psi',
            'Beta Alpha Psi is an international honors organization dedicated to fostering excellence in the fields of Financial Information and Accounting. Our chapter, Mu Psi, at UW Bothell, provides students with unparalleled networking opportunities, professional development, and a supportive community that prepares them for successful careers in finance and accounting. Join us to connect with industry leaders, enhance your skills, and be part of a prestigious network that values integrity, lifelong learning, and service. Whether you are pursuing a career in public accounting, corporate finance, or any related field, Beta Alpha Psi offers the resources and connections you need to excel. Become a member today and elevate your professional journey with Beta Alpha Psi at UW Bothell.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599677_Beta_Alpha_Psi_Logo_621194415.png',
            'Registered Student Club',
            'Professional',
            'https://gather.uwb.edu/student_community?club_id=35486',
            '35486',
            true,
            now(),
            now()
        ),
        (
            'Biology Club',
            'Biology Club is a student organization focused on providing undergraduate students a network of peers and faculty to build community within the School of STEM. Biology Club members participate in social outings, attend resume building workshops, and volunteer at events in the Seattle area, such as the yearly Seattle Sciences Festival!',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599679_Bio_club_logo_idea_1_727194012.png',
            'Registered Student Club',
            'Academic Club',
            'https://gather.uwb.edu/student_community?club_id=35508',
            '35508',
            true,
            now(),
            now()
        ),
        (
            'Black Student Union',
            'The mission of Black Student Union (BSU) at the University of Washington Bothell is to promote and celebrate Black culture and raise awareness of the diverse backgrounds that make up the Black community. We also advocate for the advancement of our socioeconomic and political status as well as further the experiences Black students face in higher education and beyond.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599681_Black_Student_Union_Logo_344152712.png',
            'Registered Student Club',
            'Cultural Club',
            'https://gather.uwb.edu/student_community?club_id=35490',
            '35490',
            true,
            now(),
            now()
        ),
        (
            'Bothell Consulting Association',
            'BCA aims to facilitate the career development of students at UWB looking to pursue Management Consulting opportunities through interview preparation, information on the industry, diverse workshops, and case practices with experienced consultants.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599680_Bothell_Consulting_Association_logo_idea_1_Black_Logo_213141813.png',
            'Registered Student Club',
            'Academic Club',
            'https://gather.uwb.edu/student_community?club_id=35509',
            '35509',
            true,
            now(),
            now()
        ),
        (
            'Bothell Racing Development',
            'The mission of Bothell Racing Development is to provide students with professional development opportunities through real-world experiences in engineering design and fabrication, while increasing interest in STEM fields on campus.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599682_Bothell_Racing_Development_Logo_idea_1_915144010.png',
            'Registered Student Club',
            'Academic Club',
            'https://gather.uwb.edu/student_community?club_id=35510',
            '35510',
            true,
            now(),
            now()
        ),
        (
            'Bothell Smash Club',
            'Bothell Smash Club was created for the purpose of engaging with the students at UW Bothell through the video game ''Super Smash Bros. Ultimate''. Our goal is to create a casual atmosphere, giving students the opportunity to hang out with each other, make friends and build community.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599683_Bothell_Smash_logo_idea_1_922153613.png',
            'Registered Student Club',
            'Social/Recreational',
            'https://gather.uwb.edu/student_community?club_id=35491',
            '35491',
            true,
            now(),
            now()
        ),
        (
            'Bothell Smash Club',
            'Bothell Smash Club was created for the purpose of engaging with the students at UW Bothell through the video game ''Super Smash Bros. Ultimate''. Our goal is to create a casual atmosphere, giving students the opportunity to hang out with each other, make friends and build community.',
            system_user_id,
            'https://gather.uwb.edu/images/default_club_logo_square.png',
            'Registered Student Club',
            'Social/Recreational',
            'https://gather.uwb.edu/student_community?club_id=35511',
            '35511',
            true,
            now(),
            now()
        ),
        (
            'Bothell Women in Science and Engineering',
            'To encourage and support women in science, technology, engineering, and mathematics (STEM) by creating an inclusive community that values diversity and promotes education and outreach.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599685_BWISE_logo_idea_1_116141915.png',
            'Registered Student Club',
            'Academic Club',
            'https://gather.uwb.edu/student_community?club_id=35492',
            '35492',
            true,
            now(),
            now()
        ),
        (
            'Brilliant Billiards Club',
            'Brilliant Billiards Club is dedicated to making the sport of billiards accessible to the UW Bothell student body. Weekly meetings are held every Thursday from 4-6pm at the Game Room within the Student Activities Center. All skill levels are welcome!',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599687_Billiards_Club_logo_idea_1_618132912.png',
            'Registered Student Club',
            'Social/Recreational',
            'https://gather.uwb.edu/student_community?club_id=35512',
            '35512',
            true,
            now(),
            now()
        ),
        (
            'BunaTalk',
            'The mission of BunaTalk is to create an inclusive and empowering space for students across the Diaspora to connect, share, and celebrate their cultural heritage. Inspired by the tradition of coffee as a symbol of community and conversation, BunaTalk strives to: Foster Cultural Awareness: Educate and engage the wider community about the richness and diversity of Habesha cultures. Build Unity: Strengthen bonds among East African and Horn of Africa communities by celebrating shared traditions and experiences. Promote Dialogue: Provide a platform for discussions on cultural identity, social issues, and student experiences. Support Empowerment: Advocate for representation, equity, and the success of Diaspora students in academic and professional settings. Through events, workshops, and collaborative projects, BunaTalk aims to honor cultural roots while paving the way for a connected and thriving community.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599686_bunatalk_white_background_1_425155211.png',
            'Registered Student Club',
            'Cultural Club',
            'https://gather.uwb.edu/student_community?club_id=35493',
            '35493',
            true,
            now(),
            now()
        ),
        (
            'Business and Case Competition',
            'Business Case Competition (BCC) is a recognized student organization dedicated to fostering critical thinking, teamwork, and business acumen among UWB students. Our mission is to prepare members for real-world business challenges through case competitions, workshops, and networking opportunities. We believe in the power of collaboration and hands-on learning to develop the skills necessary to succeed in the business world.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599688_BCC_Logo_idea_1_132132711.png',
            'Registered Student Club',
            'Academic Club',
            'https://gather.uwb.edu/student_community?club_id=35513',
            '35513',
            true,
            now(),
            now()
        ),
        (
            'Campus Events Board',
            'We host campus events throughout the year. Our club gives students experience in event planning/coordination',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599689_CEB_logo_idea_1_825162514.png',
            'Student Organization',
            NULL,
            'https://gather.uwb.edu/student_community?club_id=35514',
            '35514',
            true,
            now(),
            now()
        ),
        (
            'Car Club at UWB',
            'Our mission is to bring together automotive enthusiasts, creating a space for students to share their passion for cars while building a welcoming community. Through events like car meets, maintenance workshops, and drives, we aim to foster connections, expand knowledge, and celebrate car culture on campus.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599690_Car_Club_logo_idea_1_918133313.png',
            'Registered Student Club',
            'Special Interest',
            'https://gather.uwb.edu/student_community?club_id=35515',
            '35515',
            true,
            now(),
            now()
        ),
        (
            'Career Services',
            'UW Bothell Career Services partners with students and employers to build meaningful connections, providing career development resources and experiential learning opportunities.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599691_Gather_Profile_UWB_Career_Services_2_square_413135212.png',
            'Department',
            NULL,
            'https://gather.uwb.edu/student_community?club_id=35532',
            '35532',
            true,
            now(),
            now()
        ),
        (
            'Catholic Newman Center - UWB Chapter',
            'To strengthen our faith in Jesus Christ through fraternity, intellectual pursuit, community service, and spiritual development. We seek to make our Catholic campus ministry a home where all students, regardless of their background, can encounter the transforming love of Christ and grow in holiness.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599693_Catholic_Campus_Ministry_logo_Black_Logo_Idea_212140111.png',
            'Registered Student Club',
            'Special Interest',
            'https://gather.uwb.edu/student_community?club_id=35494',
            '35494',
            true,
            now(),
            now()
        ),
        (
            'Chemistry Club at the University of Washington, Bothell',
            'It shall be the purpose of this organization to advance the understanding and appreciation of chemistry through hands-on experiments, educational workshops, and outreach events that explore chemical principles, reactions, and their real-world applications.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_600264_UWB_Chemistry_Club_824190015.png',
            'Registered Student Club',
            'Academic Club',
            'https://gather.uwb.edu/student_community?club_id=35562',
            '35562',
            true,
            now(),
            now()
        ),
        (
            'Chinese Student Association',
            'The mission of Chinese Student Association (CSA) at the University of Washington Bothell is to provide a cultural and social community for students interested in Chinese language and culture at UWB. We strive to offer members and the surrounding community a diverse range of Chinese cultural, educational, and social activities and events.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599694_CSA_Logo_Idea_1_620161415.png',
            'Registered Student Club',
            'Cultural Club',
            'https://gather.uwb.edu/student_community?club_id=35495',
            '35495',
            true,
            now(),
            now()
        ),
        (
            'Clamor Literary and Arts Journal',
            'Clamor is a student-run literary and arts journal at the University of Washington Bothell, which also serves Cascadia College. Started in fall 1995, Clamor is published once a year in Spring Quarter. It is open to submissions from currently enrolled students at UW Bothell and Cascadia College.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599696_CLAMOR_logo_idea_1_422141311.png',
            'Student Organization',
            NULL,
            'https://gather.uwb.edu/student_community?club_id=35516',
            '35516',
            true,
            now(),
            now()
        ),
        (
            'Club Council',
            'The Club Council is the liaison for all RSCs and Student Organizations to work collaboratively, share ideas, and utilize funding transparently.',
            system_user_id,
            'https://gather.uwb.edu/upload/uwb/2024/s2_image_upload_599697_Club_council_logo_idea_1_824131513.png',
            'Student Organization',
            NULL,
            'https://gather.uwb.edu/student_community?club_id=35517',
            '35517',
            true,
            now(),
            now()
        );

    RAISE NOTICE 'Successfully inserted % clubs using creator_id: %', 33, system_user_id;
END $$;
```
-- Migration: Add UWB Event Support to Events Table
-- Description: Adds fields to distinguish official UWB events from user-created events
-- Date: 2025-11-11

-- Add new columns to events table
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS is_official_event boolean DEFAULT false;

-- Add index on is_official_event for faster queries
CREATE INDEX IF NOT EXISTS idx_events_is_official_event ON events(is_official_event);

-- Add index on event_type for filtering
CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);

-- Add index on external_id for lookups
CREATE INDEX IF NOT EXISTS idx_events_external_id ON events(external_id);

-- Fix any existing events with NULL is_official_event (set them to false for user-created events)
UPDATE events
SET is_official_event = false
WHERE is_official_event IS NULL;

-- Update RLS policies to allow viewing official events
-- Official events should be viewable by all authenticated users
DROP POLICY IF EXISTS "authenticated_select_events" ON events;

CREATE POLICY "authenticated_select_events" ON events
    FOR SELECT
    TO authenticated
    USING (
        true  -- All authenticated users can view all events (both user events and official events)
    );

-- Official events cannot be updated or deleted by regular users
-- Only allow updates/deletes for user-created events (where creator_id matches)
DROP POLICY IF EXISTS "authenticated_update_own_events" ON events;

CREATE POLICY "authenticated_update_own_events" ON events
    FOR UPDATE
    TO authenticated
    USING (
        creator_id = auth.uid() AND is_official_event = false
    );

DROP POLICY IF EXISTS "authenticated_delete_own_events" ON events;

CREATE POLICY "authenticated_delete_own_events" ON events
    FOR DELETE
    TO authenticated
    USING (
        creator_id = auth.uid() AND is_official_event = false
    );

-- Add comment explaining the new columns
COMMENT ON COLUMN events.event_type IS 'Type of event (e.g., "Campus Event", "Career Development", "Social")';
COMMENT ON COLUMN events.external_url IS 'URL to external event page (e.g., gather.uwb.edu page)';
COMMENT ON COLUMN events.external_id IS 'External system event ID (e.g., gather.uwb.edu event_id)';
COMMENT ON COLUMN events.is_official_event IS 'True if this is an official UWB event, false if user-created event';
```-- Migration: Insert UWB Official Events (Auto-detect system user)
-- Description: Inserts official UWB events from data/uwb-events.json
-- Date: 2025-11-12
-- Generated from: data/uwb-events.json

DO $$
DECLARE
    system_user_id uuid;
BEGIN
    -- Try to get an existing user
    SELECT id INTO system_user_id FROM user_profiles ORDER BY created_at LIMIT 1;

    -- If no users exist, this will fail - you need at least one user in your database
    IF system_user_id IS NULL THEN
        RAISE EXCEPTION 'No users found in user_profiles table. Please create at least one user account first.';
    END IF;

    -- Insert official UWB events using the found user ID
    INSERT INTO events (
        title,
        description,
        location,
        start_time,
        end_time,
        creator_id,
        image_url,
        event_type,
        external_url,
        external_id,
        is_official_event,
        created_at,
        updated_at
    ) VALUES
        (
            'Fall Networking Event',
            NULL,
            'ARC Overlook, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-12T20:30:00',
            '2025-11-12T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Career Workshop/Event',
            'https://gather.uwb.edu/rsvp?id=378077',
            '1b51dd5307720e9637c2ce6f97146ae010302025_3:11:33_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-11-12T21:00:00',
            '2025-11-12T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377456',
            'fcf6f7e36d3cb514469ab5c66c64f7029202025_3:05:35_PM',
            true,
            now(),
            now()
        ),
        (
            'Hot Chocolate with the HaWRC',
            NULL,
            'TBA',
            '2025-11-12T21:30:00',
            '2025-11-12T22:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Educational/Awareness',
            'https://gather.uwb.edu/rsvp?id=377689',
            'ea3b9fa0a9ad64a08633eb4f69d453399262025_7:33:38_PM',
            true,
            now(),
            now()
        ),
        (
            'GROW INTO STEM Seminar - Beyond the Lab: Bridging Science and Medicine',
            NULL,
            'Makerspace, DISC 152, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-13T00:00:00',
            '2025-11-13T01:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Career Workshop/Event',
            'https://gather.uwb.edu/rsvp?id=378033',
            'b6b77397d25016799f0c5035b87dbd9010282025_1:41:00_AM',
            true,
            now(),
            now()
        ),
        (
            'Movie night!',
            NULL,
            'TBA',
            '2025-11-13T01:00:00',
            '2025-11-13T03:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=378255',
            '790c651803c076d69ca211e85d9181b911102025_1:17:03_PM',
            true,
            now(),
            now()
        ),
        (
            'Financing Study Abroad - Workshop',
            NULL,
            'TBA',
            '2025-11-13T19:30:00',
            '2025-11-13T20:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Info Session',
            'https://gather.uwb.edu/rsvp?id=377679',
            '519c87b4733a6f9c1e9d38f75dc2b42f9262025_2:15:21_PM',
            true,
            now(),
            now()
        ),
        (
            'Drop-In Billiards',
            NULL,
            'TBA',
            '2025-11-13T21:00:00',
            '2025-11-14T01:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Athletic/Sports',
            'https://gather.uwb.edu/rsvp?id=378022',
            '319015f3040bb17250deebfcba59875b10272025_2:56:53_PM',
            true,
            now(),
            now()
        ),
        (
            'Critical Language Scholarship: Writing Workshop',
            NULL,
            'TBA',
            '2025-11-13T23:30:00',
            '2025-11-14T01:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Workshop',
            'https://gather.uwb.edu/rsvp?id=378065',
            'dc63ace406862118fa2eb25fac7aa74d10292025_6:39:18_PM',
            true,
            now(),
            now()
        ),
        (
            'VSAUWB Turkey Bowl Practice AU25',
            NULL,
            'TBA',
            '2025-11-14T04:00:00',
            '2025-11-14T06:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Athletic/Sports',
            'https://gather.uwb.edu/rsvp?id=377862',
            '25f584468c09cbcfff94449db32db0ba10142025_3:15:00_PM',
            true,
            now(),
            now()
        ),
        (
            'Student Internship Panel',
            NULL,
            'TBA',
            '2025-11-14T18:00:00',
            '2025-11-14T22:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Career Workshop/Event',
            'https://gather.uwb.edu/rsvp?id=378025',
            '69fd93099f479b8c4ee86c2892e883c910272025_4:02:52_PM',
            true,
            now(),
            now()
        ),
        (
            'BCA Consultant in Training Meeting',
            NULL,
            'TBA',
            '2025-11-14T19:00:00',
            '2025-11-14T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Workshop',
            'https://gather.uwb.edu/rsvp?id=377415',
            'b91192704dc260f0d6a0369efe6739d39182025_7:56:34_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-14T20:00:00',
            '2025-11-15T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377873',
            'f408d802d698501b85c35f2c3d3f4b4710142025_4:16:50_PM',
            true,
            now(),
            now()
        ),
        (
            'Jummu''ah',
            NULL,
            'TBA',
            '2025-11-14T20:00:00',
            '2025-11-14T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Spiritual',
            'https://gather.uwb.edu/rsvp?id=377950',
            '48686a699a019405597c738714afda3610162025_9:09:25_PM',
            true,
            now(),
            now()
        ),
        (
            'Dawah Table',
            NULL,
            'UW2 Commons Lobby Table, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-14T20:30:00',
            '2025-11-14T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Educational/Awareness',
            'https://gather.uwb.edu/rsvp?id=377941',
            '8d9809a90b32bac83496b659cae1bc5e10162025_9:02:02_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-11-14T21:00:00',
            '2025-11-14T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377457',
            '22e9623645dcc57479014b2d468eb9e99202025_3:05:37_PM',
            true,
            now(),
            now()
        ),
        (
            'BCA Fall General Meeting',
            NULL,
            'TBA',
            '2025-11-14T23:45:00',
            '2025-11-15T02:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377396',
            '51b775ae41877ffe614bffb64b34434a9172025_8:25:02_PM',
            true,
            now(),
            now()
        ),
        (
            'Potluck Around the World',
            NULL,
            'TBA',
            '2025-11-15T01:00:00',
            '2025-11-15T03:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Cultural',
            'https://gather.uwb.edu/rsvp?id=378334',
            '0de331c8f870019aa439afb5a234437911112025_12:58:17_PM',
            true,
            now(),
            now()
        ),
        (
            'Bainbridge Island Adventure',
            NULL,
            'TBA',
            '2025-11-15T16:00:00',
            '2025-11-16T01:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=377957',
            'dabc355a6a6c93303bb0053ab954f83a10172025_4:09:28_PM',
            true,
            now(),
            now()
        ),
        (
            'BUT ITS BALENCIAGA',
            NULL,
            'Innovation Hall 111, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-16T01:00:00',
            '2025-11-16T04:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=378084',
            '724e08e08b7fe16f74145f2550da35ed10312025_2:00:26_AM',
            true,
            now(),
            now()
        ),
        (
            'Global Scholars - Application Deadline',
            NULL,
            'TBA',
            '2025-11-17T07:55:00',
            '2025-11-17T07:55:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Application Deadline',
            'https://gather.uwb.edu/rsvp?id=378093',
            '3d10e0b32631fc4c9851d0a466282ee31132025_1:53:20_AM',
            true,
            now(),
            now()
        ),
        (
            'Strategic Planning SWOT Session',
            NULL,
            'TBA',
            '2025-11-17T17:00:00',
            '2025-11-17T18:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Listening Session',
            'https://gather.uwb.edu/rsvp?id=378088',
            'bf74f43e2d7ba43b4edd028a089c3a6210312025_5:25:20_PM',
            true,
            now(),
            now()
        ),
        (
            'Makers Workshop - Laser Engraving',
            NULL,
            'TBA',
            '2025-11-17T20:00:00',
            '2025-11-17T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Workshop',
            'https://gather.uwb.edu/rsvp?id=377767',
            '13770064d1b132ffb830e6051603373b1062025_5:51:59_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-11-17T21:00:00',
            '2025-11-17T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377458',
            'ebea264429f59ca7259a4a943eec17d89202025_3:05:38_PM',
            true,
            now(),
            now()
        ),
        (
            'Professional Pathways in Psychology Workshop',
            NULL,
            'North Creek Event Center, 18325 Campus Way NE, Bothell, WA, United States',
            '2025-11-17T21:00:00',
            '2025-11-17T22:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Academic',
            'https://gather.uwb.edu/rsvp?id=377661',
            '92fe300e6896f5dc6e074deee9cecb349242025_4:09:27_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays',
            NULL,
            'TBA',
            '2025-11-17T21:15:00',
            '2025-11-17T21:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=377623',
            '698c0643159a167485912760cdc5b3459222025_2:01:30_PM',
            true,
            now(),
            now()
        ),
        (
            'Mathematics Graduate School Hybrid Panel',
            NULL,
            'TBA',
            '2025-11-17T21:30:00',
            '2025-11-17T22:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Info Session',
            'https://gather.uwb.edu/rsvp?id=378206',
            '80bc5c16babec69ce3b7862d357bf8a61172025_2:44:11_AM',
            true,
            now(),
            now()
        ),
        (
            'Exploring Summer Research Programs',
            NULL,
            'TBA',
            '2025-11-17T23:00:00',
            '2025-11-18T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Info Session',
            'https://gather.uwb.edu/rsvp?id=377801',
            'e39e90ae8fcacf45d7c0ccc5072d71521082025_6:53:32_PM',
            true,
            now(),
            now()
        ),
        (
            'Udall Undergraduate Scholarship - Info Session',
            NULL,
            'TBA',
            '2025-11-18T00:00:00',
            '2025-11-18T01:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Info Session',
            'https://gather.uwb.edu/rsvp?id=378079',
            'f053c13e6450430c2844668999e4a12110302025_6:49:37_PM',
            true,
            now(),
            now()
        ),
        (
            'Game Night: Medical Trivia',
            NULL,
            'TBA',
            '2025-11-18T02:00:00',
            '2025-11-18T04:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=378180',
            '7e84266b9bb505848ec31f72595d9c181142025_7:08:47_PM',
            true,
            now(),
            now()
        ),
        (
            'VSAUWB Turkey Bowl Practice AU25',
            NULL,
            'TBA',
            '2025-11-18T04:00:00',
            '2025-11-18T06:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Athletic/Sports',
            'https://gather.uwb.edu/rsvp?id=377863',
            'f1f170548166ae92c88f9938cd797b8010142025_3:15:02_PM',
            true,
            now(),
            now()
        ),
        (
            'DSP Exec meeting',
            NULL,
            'TBA',
            '2025-11-18T04:00:00',
            '2025-11-18T06:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Academic',
            'https://gather.uwb.edu/rsvp?id=378167',
            '2e2c0a266081068323f29d0b046ad97a1132025_2:15:30_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions',
            NULL,
            'TBA',
            '2025-11-18T19:00:00',
            '2025-11-18T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=377635',
            'f41b1cbf7cba104908154bdbfa4e4dca9222025_3:01:47_PM',
            true,
            now(),
            now()
        ),
        (
            'Makers Workshop - Laser Engraving',
            NULL,
            'TBA',
            '2025-11-18T20:00:00',
            '2025-11-18T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Workshop',
            'https://gather.uwb.edu/rsvp?id=377768',
            'ae1eb65e08efb60c099840ab83918e891062025_5:57:20_PM',
            true,
            now(),
            now()
        ),
        (
            'Club Officer Orientation Session 1',
            NULL,
            'TBA',
            '2025-11-18T21:30:00',
            '2025-11-18T22:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Orientation',
            'https://gather.uwb.edu/rsvp?id=378238',
            '2d50c91f8d54d3b1bc8887734c9857cd1172025_7:37:01_PM',
            true,
            now(),
            now()
        ),
        (
            'Campus Library Native Art Walk',
            NULL,
            'TBA',
            '2025-11-18T22:30:00',
            '2025-11-19T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Cultural',
            'https://gather.uwb.edu/rsvp?id=378323',
            '58a74ad595962f4b8e2d368e0fb691e511102025_7:37:32_PM',
            true,
            now(),
            now()
        ),
        (
            'Wildlife Watch',
            NULL,
            'TBA',
            '2025-11-18T23:30:00',
            '2025-11-19T03:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Educational/Awareness',
            'https://gather.uwb.edu/rsvp?id=378035',
            '527662baebe86ee00329c41af1294b9810282025_11:59:29_AM',
            true,
            now(),
            now()
        ),
        (
            ' Mason Jar Lanterns & Mindful Moments',
            NULL,
            'TBA',
            '2025-11-19T01:00:00',
            '2025-11-19T02:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377911',
            '17a16d56b8cd120d1b762db24073daac10152025_2:47:20_AM',
            true,
            now(),
            now()
        ),
        (
            'FASA Fams Meeting',
            NULL,
            'TBA',
            '2025-11-19T01:30:00',
            '2025-11-19T03:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Cultural',
            'https://gather.uwb.edu/rsvp?id=378209',
            '408e6797a0b9b2ffb68db0bb8da388621172025_3:08:36_PM',
            true,
            now(),
            now()
        ),
        (
            'Club Officer Orientation Session 2',
            NULL,
            'TBA',
            '2025-11-19T01:30:00',
            '2025-11-19T02:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Orientation',
            'https://gather.uwb.edu/rsvp?id=378239',
            'd7f5a5a1239654817a1078d00684afb51172025_7:44:56_PM',
            true,
            now(),
            now()
        ),
        (
            'Vitals & Victories: Game Night',
            NULL,
            'TBA',
            '2025-11-19T01:45:00',
            '2025-11-19T04:15:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377999',
            '79b2d6e16a08405f6ca482db4af010c810232025_3:45:31_PM',
            true,
            now(),
            now()
        ),
        (
            'Make a Zine, Take a Zine!',
            NULL,
            'Library second floor, room LB1-205, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-19T19:00:00',
            '2025-11-19T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Workshop',
            'https://gather.uwb.edu/rsvp?id=378211',
            '7932fc76a595ac70614dbca569c2cf761172025_5:36:37_PM',
            true,
            now(),
            now()
        ),
        (
            'Study Abroad: Find Your Perfect Fit!',
            NULL,
            'TBA',
            '2025-11-19T19:30:00',
            '2025-11-19T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Academic',
            'https://gather.uwb.edu/rsvp?id=378080',
            '5449d8b67ec9f04db233de0e617b9c6810302025_6:52:58_PM',
            true,
            now(),
            now()
        ),
        (
            'Free Thrift Market',
            NULL,
            'TBA',
            '2025-11-19T20:00:00',
            '2025-11-19T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Fair',
            'https://gather.uwb.edu/rsvp?id=378256',
            '42660c34af8f26f6aefa31258a257ab311102025_1:20:48_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-11-19T21:00:00',
            '2025-11-19T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377459',
            '05aff688437e24013ca9eeef3fe5ea0f9202025_3:05:40_PM',
            true,
            now(),
            now()
        ),
        (
            'LSU FIrst General Meeting',
            NULL,
            'UW1-261 , 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-20T00:00:00',
            '2025-11-20T02:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Cultural',
            'https://gather.uwb.edu/rsvp?id=377962',
            'd69e78ccc66276ad54cdf5309023650b10182025_4:11:31_AM',
            true,
            now(),
            now()
        ),
        (
            'IEEE Seattle YP x UW Bothell Resume Workshop',
            NULL,
            'TBA',
            '2025-11-20T02:00:00',
            '2025-11-20T04:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Academic',
            'https://gather.uwb.edu/rsvp?id=378168',
            'eaea85b4068ad42ba23a51271ee6b0481132025_2:30:09_PM',
            true,
            now(),
            now()
        ),
        (
            'Chai Pe Charcha',
            NULL,
            'TBA',
            '2025-11-20T02:00:00',
            '2025-11-20T04:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=378189',
            '9658d1834c2478e6a00e9b22d03486f71152025_5:50:04_PM',
            true,
            now(),
            now()
        ),
        (
            ' VSA 3rd General Meeting AU25',
            NULL,
            'TBA',
            '2025-11-20T03:00:00',
            '2025-11-20T06:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Cultural',
            'https://gather.uwb.edu/rsvp?id=378242',
            '8eab916c6b5cad6839c9e9db9ee0bd331182025_1:53:03_AM',
            true,
            now(),
            now()
        ),
        (
            'Hot Chocolate with the HaWRC',
            NULL,
            'TBA',
            '2025-11-20T21:30:00',
            '2025-11-20T22:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Educational/Awareness',
            'https://gather.uwb.edu/rsvp?id=377690',
            'fb2125d2ec4ebac4aa70e13f270cd4be9262025_7:33:39_PM',
            true,
            now(),
            now()
        ),
        (
            'Transgender Day of Remembrance: Remembering and Celebrating Trans Lives',
            NULL,
            'TBA',
            '2025-11-20T22:00:00',
            '2025-11-21T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Celebration',
            'https://gather.uwb.edu/rsvp?id=378322',
            '2b1a8c92f92346d9c1013be7d9550ee611102025_6:12:35_PM',
            true,
            now(),
            now()
        ),
        (
            'Chaat n Chat',
            NULL,
            'DISC 162, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-21T01:30:00',
            '2025-11-21T03:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Cultural',
            'https://gather.uwb.edu/rsvp?id=378201',
            '682098877fabb84f6cac6be705d2d2881162025_7:36:19_PM',
            true,
            now(),
            now()
        ),
        (
            'PUZZLE BATTLE',
            NULL,
            'TBA',
            '2025-11-21T01:45:00',
            '2025-11-21T03:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377825',
            '69b6f32ed16fe20034405c91dad6498410102025_12:08:39_PM',
            true,
            now(),
            now()
        ),
        (
            'BunaTalk Family Dinner',
            NULL,
            'DISCOVERY HALL ROOM 162, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-21T02:00:00',
            '2025-11-21T05:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377759',
            '56913f7e44db0f39b9a85adcc29eccd51032025_3:23:01_PM',
            true,
            now(),
            now()
        ),
        (
            'VSAUWB Turkey Bowl Practice AU25',
            NULL,
            'TBA',
            '2025-11-21T04:00:00',
            '2025-11-21T06:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Athletic/Sports',
            'https://gather.uwb.edu/rsvp?id=377864',
            'f81b954e245f864a5f6e5c49e8c3112e10142025_3:15:04_PM',
            true,
            now(),
            now()
        ),
        (
            'BCA Consultant in Training Meeting',
            NULL,
            'TBA',
            '2025-11-21T19:00:00',
            '2025-11-21T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Workshop',
            'https://gather.uwb.edu/rsvp?id=377416',
            '6e18ece72d6122de5011830f063bd6f79182025_7:56:35_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-21T20:00:00',
            '2025-11-22T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377874',
            '2d0c20990a891d4df06639cd6382207010142025_4:16:51_PM',
            true,
            now(),
            now()
        ),
        (
            'Jummu''ah',
            NULL,
            'TBA',
            '2025-11-21T20:00:00',
            '2025-11-21T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Spiritual',
            'https://gather.uwb.edu/rsvp?id=377951',
            'be7ee4bf8afff6a32f311706dc1b77e010162025_9:09:27_PM',
            true,
            now(),
            now()
        ),
        (
            'Dawah Table',
            NULL,
            'UW2 Commons Lobby Table, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-21T20:30:00',
            '2025-11-21T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Educational/Awareness',
            'https://gather.uwb.edu/rsvp?id=377942',
            '17f88d1fc0e382cc22f06325edb6560610162025_9:02:03_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-11-21T21:00:00',
            '2025-11-21T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377460',
            '9dca6a33fe289609c58a2a9d4cb4abea9202025_3:05:42_PM',
            true,
            now(),
            now()
        ),
        (
            'BCA Fall General Meeting',
            NULL,
            'TBA',
            '2025-11-21T23:45:00',
            '2025-11-22T02:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377397',
            '7fbc91074f743d29e3bfbebff4bbc59a9172025_8:25:03_PM',
            true,
            now(),
            now()
        ),
        (
            'VSAUWB Turkey Bowl Practice AU25',
            NULL,
            'TBA',
            '2025-11-22T04:00:00',
            '2025-11-22T06:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Athletic/Sports',
            'https://gather.uwb.edu/rsvp?id=377865',
            '12a61d304eec671294aa87418f64d9eb10142025_3:15:05_PM',
            true,
            now(),
            now()
        ),
        (
            'UW Bothell Study Abroad Ambassador Scholarship',
            NULL,
            'TBA',
            '2025-11-22T07:55:00',
            '2025-11-22T07:55:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Application Deadline',
            'https://gather.uwb.edu/rsvp?id=377212',
            '0c4f361cd3453ff5b7567724be27b06a6182025_1:19:55_AM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-11-24T21:00:00',
            '2025-11-24T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377461',
            '920a47dbf03ec8d9b248855cea7fa28d9202025_3:05:44_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays',
            NULL,
            'TBA',
            '2025-11-24T21:15:00',
            '2025-11-24T21:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=377624',
            '502a9f310ee073ab8fd94692ea70bfc19222025_2:01:32_PM',
            true,
            now(),
            now()
        ),
        (
            'Husky Hooks & Needles Club Meetings',
            NULL,
            'TBA',
            '2025-11-24T21:30:00',
            '2025-11-24T22:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=378258',
            '6b669067d5940ce7cfd802434dc6aab311102025_1:32:11_PM',
            true,
            now(),
            now()
        ),
        (
            'Electrical Engineering Research Talk: Moore’s Law Is Dead — Time to Scale Upward',
            NULL,
            'DISC-464 (also on Zoom), 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-25T00:30:00',
            '2025-11-25T02:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Career Workshop/Event',
            'https://gather.uwb.edu/rsvp?id=378210',
            'fbd758f02795b7192efefc0500748c351172025_4:36:40_PM',
            true,
            now(),
            now()
        ),
        (
            'WiB Friendsgiving: Gather, Grow, & Give Thanks',
            NULL,
            'TBA',
            '2025-11-25T03:00:00',
            '2025-11-25T04:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=378248',
            '9ad165f8f8036aa21f0754ed8ea1a3ee1192025_7:46:01_PM',
            true,
            now(),
            now()
        ),
        (
            'VSAUWB Turkey Bowl Practice AU25',
            NULL,
            'TBA',
            '2025-11-25T04:00:00',
            '2025-11-25T06:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Athletic/Sports',
            'https://gather.uwb.edu/rsvp?id=377866',
            'a3c14816c5606f3912165a544c2e639910142025_3:15:07_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions',
            NULL,
            'TBA',
            '2025-11-25T19:00:00',
            '2025-11-25T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=377636',
            'b6d60c0f59a6ef647b287a25501772729222025_3:01:48_PM',
            true,
            now(),
            now()
        ),
        (
            'BCA Case & Cider',
            NULL,
            'TBA',
            '2025-11-26T01:00:00',
            '2025-11-26T03:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377955',
            '9117c204b3238017f9dd2912697f952410172025_12:24:09_AM',
            true,
            now(),
            now()
        ),
        (
            'Native America Heritage Night',
            NULL,
            'Arc overlook, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-26T01:00:00',
            '2025-11-26T04:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Educational/Awareness',
            'https://gather.uwb.edu/rsvp?id=378171',
            'f43c18e283faf4beb4fdef62d33ed19d1132025_7:06:30_PM',
            true,
            now(),
            now()
        ),
        (
            'Career panel night',
            NULL,
            'discovery 162, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-26T02:00:00',
            '2025-11-26T04:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Career Workshop/Event',
            'https://gather.uwb.edu/rsvp?id=377968',
            '8a05565dd8a7fbbb41d03395447e606c10202025_3:10:07_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-11-26T21:00:00',
            '2025-11-26T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377462',
            '2bdabd357ec5faafd755ded00a54782a9202025_3:05:46_PM',
            true,
            now(),
            now()
        ),
        (
            'Hot Chocolate with the HaWRC',
            NULL,
            'TBA',
            '2025-11-26T21:30:00',
            '2025-11-26T22:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Educational/Awareness',
            'https://gather.uwb.edu/rsvp?id=377691',
            '66809193be83dea0b62e2da5efa3fcfa9262025_7:33:41_PM',
            true,
            now(),
            now()
        ),
        (
            'Winter Donation Drive',
            NULL,
            'TBA',
            '2025-11-27T02:00:00',
            '2025-11-27T04:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Job/Volunteer Opportunities',
            'https://gather.uwb.edu/rsvp?id=377963',
            '06f709da1106a3ad35f7aa4d3e264a8e10182025_4:06:26_PM',
            true,
            now(),
            now()
        ),
        (
            'BCA Consultant in Training Meeting',
            NULL,
            'TBA',
            '2025-11-28T19:00:00',
            '2025-11-28T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Workshop',
            'https://gather.uwb.edu/rsvp?id=377417',
            '611a25e87703786a8fce67b63c714b149182025_7:56:37_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-28T20:00:00',
            '2025-11-29T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377875',
            '7797e06a08e39400ee295403cb10d73a10142025_4:16:52_PM',
            true,
            now(),
            now()
        ),
        (
            'Jummu''ah',
            NULL,
            'TBA',
            '2025-11-28T20:00:00',
            '2025-11-28T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Spiritual',
            'https://gather.uwb.edu/rsvp?id=377952',
            '53fda416a2e129676124aaba08572f2c10162025_9:09:28_PM',
            true,
            now(),
            now()
        ),
        (
            'Dawah Table',
            NULL,
            'UW2 Commons Lobby Table, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-11-28T20:30:00',
            '2025-11-28T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Educational/Awareness',
            'https://gather.uwb.edu/rsvp?id=377943',
            '5845fb6353082831b39960ff6aab92c010162025_9:02:04_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-11-28T21:00:00',
            '2025-11-28T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377463',
            'fa11b8c627913f0eccc96c9ab2be37df9202025_3:05:48_PM',
            true,
            now(),
            now()
        ),
        (
            'BCA Fall General Meeting',
            NULL,
            'TBA',
            '2025-11-28T23:45:00',
            '2025-11-29T02:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377398',
            '971ce84275a4f5169b51b98a88fe6f4e9172025_8:25:05_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-01T21:00:00',
            '2025-12-01T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377464',
            'eecbf24dc9f2f229f9d972ea5bfd7ec69202025_3:05:50_PM',
            true,
            now(),
            now()
        ),
        (
            'Wellness Day hosted by BWiSE!',
            NULL,
            'TBA',
            '2025-12-02T02:00:00',
            '2025-12-02T04:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Academic',
            'https://gather.uwb.edu/rsvp?id=378183',
            'c4c527bae211deecdd157832e1ec223c1142025_10:26:10_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions',
            NULL,
            'TBA',
            '2025-12-02T19:00:00',
            '2025-12-02T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=377637',
            '0760909b36d6fe415424508cdd7c14039222025_3:01:49_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-03T21:00:00',
            '2025-12-03T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377465',
            'c2391721a6bde396bfd504278c6a29c39202025_3:05:51_PM',
            true,
            now(),
            now()
        ),
        (
            'Math Society Movie & Craft Social',
            NULL,
            'TBA',
            '2025-12-03T21:00:00',
            '2025-12-04T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=378187',
            '29492f5d39c24abc40aaa058b4c8048c1152025_1:48:47_AM',
            true,
            now(),
            now()
        ),
        (
            'Yoga & Pilates at the Campus Library!',
            NULL,
            'LB1-205 (Campus Library, 2nd Floor), 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-12-03T22:00:00',
            '2025-12-03T22:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378240',
            '24dc9735ac97d1520d5d9a51fc25b7e01172025_8:00:33_PM',
            true,
            now(),
            now()
        ),
        (
            'OTP Friendship Bracelet Event',
            NULL,
            'TBA',
            '2025-12-03T23:30:00',
            '2025-12-04T01:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Info Session',
            'https://gather.uwb.edu/rsvp?id=378208',
            '51e53f54a4a9d2c4c6edc079e9cf91e91172025_12:27:19_PM',
            true,
            now(),
            now()
        ),
        (
            'PhAst End of Quarter Social',
            NULL,
            'TBA',
            '2025-12-03T23:30:00',
            '2025-12-04T01:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=378253',
            '364aa0b732bf1456031c47f5e1d2dd5811102025_1:09:23_PM',
            true,
            now(),
            now()
        ),
        (
            'Pre-Medical: Research Networking',
            NULL,
            'TBA',
            '2025-12-04T02:00:00',
            '2025-12-04T04:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Academic',
            'https://gather.uwb.edu/rsvp?id=378181',
            '217279986f3b54a01d135ea935c1a8c01142025_7:20:03_PM',
            true,
            now(),
            now()
        ),
        (
            'Dawah Table',
            NULL,
            'UW2 Commons Lobby Table, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-12-04T20:30:00',
            '2025-12-04T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Educational/Awareness',
            'https://gather.uwb.edu/rsvp?id=377944',
            'edd9cc0f3678ee03ddf9eb0b00884e0210162025_9:02:05_PM',
            true,
            now(),
            now()
        ),
        (
            'Hot Chocolate with the HaWRC',
            NULL,
            'TBA',
            '2025-12-04T21:30:00',
            '2025-12-04T22:30:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Educational/Awareness',
            'https://gather.uwb.edu/rsvp?id=377692',
            '5586777c2b07ad2d497c710a18529aa59262025_7:33:42_PM',
            true,
            now(),
            now()
        ),
        (
            'BCA Consultant in Training Meeting',
            NULL,
            'TBA',
            '2025-12-05T19:00:00',
            '2025-12-05T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Workshop',
            'https://gather.uwb.edu/rsvp?id=377418',
            '9c5181da589f525758b0a0d5990a1a9a9182025_7:56:38_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-12-05T20:00:00',
            '2025-12-06T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377876',
            'b305b3d056c1a325cd113d9cc6fbd69810142025_4:16:53_PM',
            true,
            now(),
            now()
        ),
        (
            'Jummu''ah',
            NULL,
            'TBA',
            '2025-12-05T20:00:00',
            '2025-12-05T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Spiritual',
            'https://gather.uwb.edu/rsvp?id=377953',
            '6ae17061f1f62b2e47b0ca71ae78219a10162025_9:09:29_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-05T21:00:00',
            '2025-12-05T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377466',
            '576eb49aacafbded3cb331a53f924ce89202025_3:05:53_PM',
            true,
            now(),
            now()
        ),
        (
            'BCA Fall General Meeting',
            NULL,
            'TBA',
            '2025-12-05T23:45:00',
            '2025-12-06T02:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377399',
            'b2cda05798b9f4ce9eda8860d65f1f399172025_8:25:07_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-08T21:00:00',
            '2025-12-08T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377467',
            '6ccc84353ed8a0da91477ff38437ad9e9202025_3:05:55_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays',
            NULL,
            'TBA',
            '2025-12-08T21:15:00',
            '2025-12-08T21:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=377625',
            '33ceaadd84bb5aa4676ca185bf32ee719222025_2:01:33_PM',
            true,
            now(),
            now()
        ),
        (
            'Yoga & Pilates at the Campus Library',
            NULL,
            'LB1-205 (Campus Library, 2nd Floor), 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-12-09T00:00:00',
            '2025-12-09T00:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378241',
            '158ae658c67f4b8eafc87f3de0ff1cbd1172025_8:07:39_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions',
            NULL,
            'TBA',
            '2025-12-09T19:00:00',
            '2025-12-09T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=377638',
            'cb4270c58c0373a6eaea5209abab83f69222025_3:01:50_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-10T21:00:00',
            '2025-12-10T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377468',
            'd1fde2b2dc95b22b96c6d297c14e390e9202025_3:05:56_PM',
            true,
            now(),
            now()
        ),
        (
            'BCA Consultant in Training Meeting',
            NULL,
            'TBA',
            '2025-12-12T19:00:00',
            '2025-12-12T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Workshop',
            'https://gather.uwb.edu/rsvp?id=377419',
            'aaaeb9fa38081c233eba4812ec6d1a0b9182025_7:56:39_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-12-12T20:00:00',
            '2025-12-13T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377877',
            'ff5a240a76bdda9d55be6732e4cc11ac10142025_4:16:55_PM',
            true,
            now(),
            now()
        ),
        (
            'Jummu''ah',
            NULL,
            'TBA',
            '2025-12-12T20:00:00',
            '2025-12-12T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Spiritual',
            'https://gather.uwb.edu/rsvp?id=377954',
            'b54887739ea9971a8c9a358aacb4297510162025_9:09:31_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-12T21:00:00',
            '2025-12-12T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377469',
            'b6d314fbf73e0e7f0ad9e921b15d0fcf9202025_3:05:58_PM',
            true,
            now(),
            now()
        ),
        (
            'BCA Fall General Meeting',
            NULL,
            'TBA',
            '2025-12-12T23:45:00',
            '2025-12-13T02:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377400',
            'b5ac3f5c6c309a01067c44a2b55b973b9172025_8:25:08_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-15T21:00:00',
            '2025-12-15T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377470',
            '3347ac3e0e86ad852b4d992bc88f906b9202025_3:06:00_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays',
            NULL,
            'TBA',
            '2025-12-15T21:15:00',
            '2025-12-15T21:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=377626',
            '24173ae8228a0c4588dd5fd8b4469be39222025_2:01:35_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-17T21:00:00',
            '2025-12-17T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377471',
            'c3da63e176845b25c6df1082bfcb80279202025_3:06:01_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-12-19T20:00:00',
            '2025-12-20T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377878',
            '4b89368b6634dfc7d579b3825ab7031b10142025_4:16:56_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-19T21:00:00',
            '2025-12-19T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377472',
            '6bbefe3db27a059f7d9f999888d5afc09202025_3:06:03_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-22T21:00:00',
            '2025-12-22T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377473',
            '51deadd8f6ef33a577fc02c8e47d20289202025_3:06:05_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-24T21:00:00',
            '2025-12-24T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377474',
            '44676dd0b756fe395b71d1083d010dc49202025_3:06:07_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2025-12-26T20:00:00',
            '2025-12-27T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377879',
            'a850fd933a06e48637718ddc58f0db6710142025_4:16:57_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-26T21:00:00',
            '2025-12-26T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377475',
            'ffacab896b67bab569cf8d5e3c1c305d9202025_3:06:08_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-29T21:00:00',
            '2025-12-29T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377476',
            '5fbe46b32f3b66ac6ac3dc102725ae6d9202025_3:06:10_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2025-12-31T21:00:00',
            '2025-12-31T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377477',
            '63d23f158d229397599bb049ba75f1579202025_3:06:12_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-01-02T20:00:00',
            '2026-01-03T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377880',
            'b8a809a4a5138a4cb0fd6ef39fd48a7210142025_4:16:58_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-01-02T21:00:00',
            '2026-01-02T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377478',
            '9f6ff363d80c6b4fa57186307447233f9202025_3:06:14_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-01-05T21:00:00',
            '2026-01-05T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377479',
            '2d4add7c61be9a09d6ccfcb540e792909202025_3:06:15_PM',
            true,
            now(),
            now()
        ),
        (
            'AMERICORPS ENVIRONMENTAL EDUCATION POSITION WITH COSEE',
            NULL,
            'TBA',
            '2026-01-05T21:00:00',
            '2026-06-12T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Job/Volunteer Opportunities',
            'https://gather.uwb.edu/rsvp?id=378028',
            '0539c79fc9da4481d0a08453bce74ce110272025_5:49:52_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays Winter Quarter',
            NULL,
            'ARC Fitness Studio, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-01-05T21:15:00',
            '2026-01-05T21:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378212',
            'c62ae2418a90ad76eca82cb202f2a4d81172025_6:06:16_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions  Winter Quarter ''26',
            NULL,
            'TBA',
            '2026-01-06T19:00:00',
            '2026-01-06T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378223',
            'ca0bb74f683d73fd2dea8d99c3fb7ec21172025_6:39:06_PM',
            true,
            now(),
            now()
        ),
        (
            'Is Anxiety Holding You Back?  Winter Quarter Group',
            NULL,
            'TBA',
            '2026-01-06T21:30:00',
            '2026-01-06T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378235',
            'a4b733eadb5d288e9154c3623e3bbbe51172025_6:48:02_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-01-07T21:00:00',
            '2026-01-07T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377480',
            '8c1065e3358a2915a8887310e899ccdd9202025_3:06:17_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-01-09T20:00:00',
            '2026-01-10T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377881',
            '430752a27832e433d6168903cf8e86b610142025_4:16:59_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-01-09T21:00:00',
            '2026-01-09T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377481',
            '984e5259d9eecce7cb288db3db5a8dfe9202025_3:06:19_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-01-12T21:00:00',
            '2026-01-12T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377482',
            '2e66c5d72d24b0d4893e24c5035adb2c9202025_3:06:20_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays Winter Quarter',
            NULL,
            'ARC Fitness Studio, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-01-12T21:15:00',
            '2026-01-12T21:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378213',
            'd4cd0bb36c2794d2e6c0a79eb8e348d91172025_6:28:32_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions  Winter Quarter ''26',
            NULL,
            'TBA',
            '2026-01-13T19:00:00',
            '2026-01-13T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378224',
            '3fa93368aba4187181c330fb4ed9358f1172025_6:42:55_PM',
            true,
            now(),
            now()
        ),
        (
            'Is Anxiety Holding You Back?  Winter Quarter Group',
            NULL,
            'TBA',
            '2026-01-13T21:30:00',
            '2026-01-13T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378236',
            '71d0c68d98a99ffffc13fdda5c5eb7371172025_7:24:47_PM',
            true,
            now(),
            now()
        ),
        (
            'Makers Session',
            NULL,
            'TBA',
            '2026-01-14T20:00:00',
            '2026-01-14T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Workshop',
            'https://gather.uwb.edu/rsvp?id=377771',
            'dc13b11a81aed411c54bb8b197f93e011062025_7:12:41_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-01-14T21:00:00',
            '2026-01-14T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377483',
            '250069152145eb96c3a408f73f6fa7159202025_3:06:22_PM',
            true,
            now(),
            now()
        ),
        (
            '2026 UW Study Abroad Fair',
            NULL,
            'TBA',
            '2026-01-15T18:00:00',
            '2026-01-15T22:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Fair',
            'https://gather.uwb.edu/rsvp?id=377208',
            'e952e0ab2dc7fb50544bed801672e7606172025_9:56:36_PM',
            true,
            now(),
            now()
        ),
        (
            'Makers Session',
            NULL,
            'TBA',
            '2026-01-15T20:00:00',
            '2026-01-15T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Workshop',
            'https://gather.uwb.edu/rsvp?id=377772',
            '8b432569280e441292172939bca6ddec1062025_7:25:36_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-01-16T20:00:00',
            '2026-01-17T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377882',
            'ba519ae91e5cbd6afc89083661c6cd8510142025_4:17:00_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-01-16T21:00:00',
            '2026-01-16T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377484',
            '1bf3148d8e6271aaf81214b0686a84f79202025_3:06:24_PM',
            true,
            now(),
            now()
        ),
        (
            'Pataka',
            NULL,
            'ARC OVERLOOK, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-01-17T02:00:00',
            '2026-01-17T06:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Cultural',
            'https://gather.uwb.edu/rsvp?id=377833',
            'b115f0bf029bc346343f6cff99755e6410102025_6:22:16_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-01-19T21:00:00',
            '2026-01-19T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377485',
            'f59af7c0661e53de2668cc06bbbf73889202025_3:06:26_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays Winter Quarter',
            NULL,
            'ARC Fitness Studio, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-01-19T21:15:00',
            '2026-01-19T21:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378214',
            'af2e7edda270656c238c90e71a3f97251172025_6:29:39_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions  Winter Quarter ''26',
            NULL,
            'TBA',
            '2026-01-20T19:00:00',
            '2026-01-20T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378225',
            'ec2ef2b541c0378220a63cd848c8cdb71172025_6:43:00_PM',
            true,
            now(),
            now()
        ),
        (
            'Is Anxiety Holding You Back?  Winter Quarter Group',
            NULL,
            'TBA',
            '2026-01-20T21:30:00',
            '2026-01-20T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378237',
            '4ffda86556ccc79f7fbbb16af481024d1172025_7:24:49_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-01-21T21:00:00',
            '2026-01-21T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377486',
            'da0006e203cd004ddc54dfce3a959a689202025_3:06:27_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-01-23T20:00:00',
            '2026-01-24T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377883',
            '89c291e437c24a7ebec5aeb7bfa5d3a210142025_4:17:01_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-01-23T21:00:00',
            '2026-01-23T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377487',
            '9e78f96536bfa3b4e4ea48f4c8217a1b9202025_3:06:29_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-01-26T21:00:00',
            '2026-01-26T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377488',
            '3123051ce88edce46d770f8edf53b6f09202025_3:06:31_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays Winter Quarter',
            NULL,
            'ARC Fitness Studio, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-01-26T21:15:00',
            '2026-01-26T21:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378215',
            'b1557148a91b66f16938a4bfd4e9e66f1172025_6:30:52_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions  Winter Quarter ''26',
            NULL,
            'TBA',
            '2026-01-27T19:00:00',
            '2026-01-27T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378226',
            '76a162d349cc829c9ee8194893ae934d1172025_6:43:02_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-01-28T21:00:00',
            '2026-01-28T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377489',
            '8dd87c64857fbebe1cb9b60f2d4bcd239202025_3:06:33_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-01-30T20:00:00',
            '2026-01-31T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377884',
            '9edc6eeb403c4638e8b99eb94942749710142025_4:17:02_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-01-30T21:00:00',
            '2026-01-30T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377490',
            '953bd177c8e41bdf3d1814faf5fac4499202025_3:06:35_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-02-02T21:00:00',
            '2026-02-02T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377491',
            'bbcc207fef29876363208af188c80b129202025_3:06:37_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays Winter Quarter',
            NULL,
            'ARC Fitness Studio, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-02-02T21:15:00',
            '2026-02-02T21:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378216',
            '77b9210e582dbc2a8b2835455312df191172025_6:32:17_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions  Winter Quarter ''26',
            NULL,
            'TBA',
            '2026-02-03T19:00:00',
            '2026-02-03T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378227',
            'a8cf2f7a53206d218d8acdbf1ce66ab41172025_6:43:04_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-02-04T21:00:00',
            '2026-02-04T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377492',
            '65af5128ab341a966451339e88dc6ef49202025_3:06:39_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-02-06T20:00:00',
            '2026-02-07T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377885',
            'aea2a511e88374aeca32d37989a214fb10142025_4:17:03_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-02-06T21:00:00',
            '2026-02-06T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377493',
            '31b497c5200a0674974cee267f83610c9202025_3:06:41_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-02-09T21:00:00',
            '2026-02-09T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377494',
            '1b0c326aec85ea8e6bc0902ec5ab602d9202025_3:06:42_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays Winter Quarter',
            NULL,
            'ARC Fitness Studio, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-02-09T21:15:00',
            '2026-02-09T21:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378217',
            '994fe2246ce26a33495abcb9a7e248851172025_6:33:17_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions  Winter Quarter ''26',
            NULL,
            'TBA',
            '2026-02-10T19:00:00',
            '2026-02-10T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378228',
            'feaa9606698e18ed4387460ca22e3a3c1172025_6:43:06_PM',
            true,
            now(),
            now()
        ),
        (
            'UWB Makers Fair 2026',
            NULL,
            'Activities and Recreation Center (ARC) + North Creek Events Center (NCEC), 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-02-11T20:00:00',
            '2026-02-12T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Fair',
            'https://gather.uwb.edu/rsvp?id=377848',
            '020763b44b7faaf8d3f654fcbaa2a76d10132025_8:03:37_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-02-11T21:00:00',
            '2026-02-11T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377495',
            '3161fad11f2dfa481cd39953cd1af87c9202025_3:06:44_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-02-13T20:00:00',
            '2026-02-14T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377886',
            'dbd1ae7587fe71bf7e253b98280ce00b10142025_4:17:04_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-02-13T21:00:00',
            '2026-02-13T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377496',
            '44ab2215ec5a4bf4e5d26db82aa43e149202025_3:06:46_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-02-16T21:00:00',
            '2026-02-16T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377497',
            'fb47db8239ed9194c0633bba163dbc799202025_3:06:48_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions  Winter Quarter ''26',
            NULL,
            'TBA',
            '2026-02-17T19:00:00',
            '2026-02-17T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378229',
            '73a1c19ca49dccb0e6c2abdd89afa30a1172025_6:43:07_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-02-18T21:00:00',
            '2026-02-18T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377498',
            '351a64f1c9e9e3ed25f1e5a1b9012fbf9202025_3:06:50_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-02-20T20:00:00',
            '2026-02-21T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377887',
            'f2aeef0530014f0a13ffd1959f80713410142025_4:17:05_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-02-20T21:00:00',
            '2026-02-20T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377499',
            'b0d9c5956d3ba11cfc9adfb23ba1f8aa9202025_3:06:52_PM',
            true,
            now(),
            now()
        ),
        (
            'UW Bothell Study Abroad Ambassador Scholarship',
            NULL,
            'TBA',
            '2026-02-21T07:55:00',
            '2026-02-21T07:55:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Application Deadline',
            'https://gather.uwb.edu/rsvp?id=377213',
            '305748501a22c126d60265e9872f0d266182025_1:29:11_AM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-02-23T21:00:00',
            '2026-02-23T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377500',
            '791231a08f559b46a9670eddb2b3ef4c9202025_3:06:54_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays Winter Quarter',
            NULL,
            'ARC Fitness Studio, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-02-23T21:15:00',
            '2026-02-23T21:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378219',
            '5c342240c9854e838d74ba12850913a61172025_6:34:31_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions  Winter Quarter ''26',
            NULL,
            'TBA',
            '2026-02-24T19:00:00',
            '2026-02-24T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378230',
            '80f2ac62ca781130bba6afc02aec1c311172025_6:43:09_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-02-25T21:00:00',
            '2026-02-25T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377501',
            '81e5064512d4f52421ea89acf3c79c739202025_3:06:56_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-02-27T20:00:00',
            '2026-02-28T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377888',
            'ff186dcc8cb150cac307aabaa9542cbc10142025_4:17:06_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-02-27T21:00:00',
            '2026-02-27T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377502',
            '3757e228b58256c9805a2f82e38a79c09202025_3:06:58_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-03-02T21:00:00',
            '2026-03-02T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377503',
            '6b2648a4a94e94fa38f7df78825e1ea49202025_3:07:00_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays Winter Quarter',
            NULL,
            'ARC Fitness Studio, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-03-02T21:15:00',
            '2026-03-02T21:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378220',
            '65fdccfd4223e9c5dea7326d2015b6e01172025_6:35:03_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions  Winter Quarter ''26',
            NULL,
            'TBA',
            '2026-03-03T19:00:00',
            '2026-03-03T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378231',
            '9a70c9bc19536d678e45e8ccbe8ce6621172025_6:43:11_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-03-04T21:00:00',
            '2026-03-04T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377504',
            'f33fde3494e684a2799a33f9a0ffa7229202025_3:07:02_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-03-06T20:00:00',
            '2026-03-07T00:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377889',
            'f0ec672dc887fb1ead8ac2cd759547cb10142025_4:17:08_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-03-06T21:00:00',
            '2026-03-06T21:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377505',
            '7d45ffa9b716dafc98d74ab5c15196f09202025_3:07:03_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-03-09T20:00:00',
            '2026-03-09T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377506',
            'afd5c734c39ce819f40eebae109b5c0c9202025_3:07:05_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays Winter Quarter',
            NULL,
            'ARC Fitness Studio, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-03-09T20:15:00',
            '2026-03-09T20:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378221',
            '890d57c5b0465e495057903e2d94855a1172025_6:35:28_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions  Winter Quarter ''26',
            NULL,
            'TBA',
            '2026-03-10T18:00:00',
            '2026-03-10T19:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378232',
            'f0b677c3a4c258cb34c47fce2484050f1172025_6:43:12_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-03-11T20:00:00',
            '2026-03-11T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377507',
            '202fd339d7edeeab7e13a4920b63e4f69202025_3:07:07_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-03-13T19:00:00',
            '2026-03-13T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377890',
            'a641d5ee7bb21744684f25b1e3840d8210142025_4:17:09_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-03-13T20:00:00',
            '2026-03-13T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377508',
            'd87b040f72c7e545a041581c248725509202025_3:07:09_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-03-16T20:00:00',
            '2026-03-16T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377509',
            'fd647d181d9efc151dd679c5d0a9e9e99202025_3:07:11_PM',
            true,
            now(),
            now()
        ),
        (
            'Mindful Mondays Winter Quarter',
            NULL,
            'ARC Fitness Studio, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-03-16T20:15:00',
            '2026-03-16T20:45:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378222',
            'deec02c0362da9a813ff73881f1bd9ed1172025_6:35:57_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions  Winter Quarter ''26',
            NULL,
            'TBA',
            '2026-03-17T18:00:00',
            '2026-03-17T19:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378233',
            '37f6ac849508fcce704faab68db3ad0d1172025_6:43:18_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-03-18T20:00:00',
            '2026-03-18T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377510',
            '3f0e44de4a3ce10e8df183b77bc2f1429202025_3:07:13_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-03-20T19:00:00',
            '2026-03-20T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377891',
            '2f3ec7609cca9923b912454831e07b5d10142025_4:17:10_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-03-20T20:00:00',
            '2026-03-20T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377511',
            '4e1c22dff829ea5b686f9eaabaa6b6009202025_3:07:15_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-03-23T20:00:00',
            '2026-03-23T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377512',
            '4f0704fa6dbffea0d9381f33ff6e98369202025_3:07:17_PM',
            true,
            now(),
            now()
        ),
        (
            'Creative Expressions  Winter Quarter ''26',
            NULL,
            'TBA',
            '2026-03-24T18:00:00',
            '2026-03-24T19:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Wellness',
            'https://gather.uwb.edu/rsvp?id=378234',
            '7457fe6babe5076e007062c903328c8c1172025_6:43:20_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-03-25T20:00:00',
            '2026-03-25T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377513',
            '4787ed2b6c5bae4feaee6ea7339a880a9202025_3:07:18_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-03-27T19:00:00',
            '2026-03-27T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377892',
            '38c4ee73b8a3e5ad71cc5425ad474ffa10142025_4:17:11_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-03-27T20:00:00',
            '2026-03-27T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377514',
            '40ced3b242300b81847bceb88cc8fe929202025_3:07:20_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-03-30T20:00:00',
            '2026-03-30T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377515',
            '57b2d6df2e9d37924dce564f9450c3719202025_3:07:22_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-04-01T20:00:00',
            '2026-04-01T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377516',
            '5bfada92c8c144c6e2795e0f7cf09c8b9202025_3:07:24_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-04-03T19:00:00',
            '2026-04-03T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377893',
            '89f0ac0a2ae5df23e26cd7447053f70f10142025_4:17:12_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-04-03T20:00:00',
            '2026-04-03T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377517',
            '79e036dd2d2c06ab54bbc403a3e4a2789202025_3:07:26_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-04-06T20:00:00',
            '2026-04-06T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377518',
            '54693ad5caf1b9867b745b4a5978f8349202025_3:07:28_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-04-08T20:00:00',
            '2026-04-08T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377519',
            'e2ba7e9734c194337e82e54c444882b09202025_3:07:30_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-04-10T19:00:00',
            '2026-04-10T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377894',
            'a7d7a027dd26f2b46d5226d32128b3ac10142025_4:17:13_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-04-10T20:00:00',
            '2026-04-10T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377520',
            '04008e07848661b088c735d303c79cc49202025_3:07:32_PM',
            true,
            now(),
            now()
        ),
        (
            'UW Bothell Study Abroad Ambassador Scholarship',
            NULL,
            'TBA',
            '2026-04-11T06:55:00',
            '2026-04-11T06:55:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Application Deadline',
            'https://gather.uwb.edu/rsvp?id=377214',
            'ed33b17fa0efb17aec1f212292d015406182025_1:32:03_AM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-04-13T20:00:00',
            '2026-04-13T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377521',
            '4c59b2fa50879ec4f1acbc773c7ca0b29202025_3:07:34_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-04-15T20:00:00',
            '2026-04-15T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377522',
            '48cfacd8c85c162c210e2ca5115451ea9202025_3:07:36_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-04-17T19:00:00',
            '2026-04-17T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377895',
            '3bcbfcdcc395988362cb7d5ab2a616ae10142025_4:17:14_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-04-17T20:00:00',
            '2026-04-17T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377523',
            'ab8b77595d9b9a4f2bbcf916596efad49202025_3:07:38_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-04-20T20:00:00',
            '2026-04-20T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377524',
            '048e06f533b71d165d5b4d67aad10fb29202025_3:07:40_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-04-22T20:00:00',
            '2026-04-22T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377525',
            '223ddb0c1b8c469b850a7599d50c8f6d9202025_3:07:42_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-04-24T19:00:00',
            '2026-04-24T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377896',
            '74b430cfc9e5add049f60d7d18e2a16510142025_4:17:15_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-04-24T20:00:00',
            '2026-04-24T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377526',
            '78fb672f6eaf7df0ec9e4f8c94dae87b9202025_3:07:44_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-04-27T20:00:00',
            '2026-04-27T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377527',
            '2c29eb3e0cd9482695a7dabae904e5db9202025_3:07:46_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-04-29T20:00:00',
            '2026-04-29T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377528',
            '5e2cdf8da00c41c9e3712cc29d10178d9202025_3:07:48_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-05-01T19:00:00',
            '2026-05-01T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377897',
            '452867d3229b87c4149eb882a0595f1e10142025_4:17:16_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-05-01T20:00:00',
            '2026-05-01T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377529',
            'b7f4f1d43101cc6aedacbf5b305341409202025_3:07:49_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-05-04T20:00:00',
            '2026-05-04T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377530',
            '03a032d68abbc65e1d596e8542ef9c609202025_3:07:51_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-05-06T20:00:00',
            '2026-05-06T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377531',
            '03246243dbc67de7d056cf140aa00d649202025_3:07:53_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-05-08T19:00:00',
            '2026-05-08T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377898',
            '8779bdac6f9b8fcb2a381646615c895810142025_4:17:18_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-05-08T20:00:00',
            '2026-05-08T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377532',
            '7d711063951eb5fe901c3ba2620c0a969202025_3:07:55_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-05-11T20:00:00',
            '2026-05-11T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377533',
            '6280644fce82918e5f1946089a282c2e9202025_3:07:57_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-05-13T20:00:00',
            '2026-05-13T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377534',
            'a33dbbdcfb5fbedb373ad73b6b7379969202025_3:07:58_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-05-15T19:00:00',
            '2026-05-15T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377899',
            '20c273ed7e254363879fb2e094fca27010142025_4:17:19_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-05-15T20:00:00',
            '2026-05-15T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377535',
            '90c17f2de690770cf8e5ba0adb3af1de9202025_3:08:00_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-05-18T20:00:00',
            '2026-05-18T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377536',
            'bffd21ca8dbc3e8eb68d73d316930d6d9202025_3:08:02_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-05-20T20:00:00',
            '2026-05-20T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377537',
            '0b39e66ff7822fde283eaddb4f5d58199202025_3:08:04_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-05-22T19:00:00',
            '2026-05-22T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377900',
            '826beccdc2d6f471d73fad005e5348e710142025_4:17:20_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-05-22T20:00:00',
            '2026-05-22T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377538',
            'f4179e4dc64103b97f0ad07760cd2b0e9202025_3:08:06_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-05-25T20:00:00',
            '2026-05-25T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377539',
            'bc37ba189baca0001fdb424e4f2a5d709202025_3:08:08_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-05-27T20:00:00',
            '2026-05-27T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377540',
            '71b572b0fe7cbada5bbdc3aa7ff724339202025_3:08:10_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-05-29T19:00:00',
            '2026-05-29T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377901',
            'd429c5b9392bb056707f0b21a39e3fa910142025_4:17:21_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-05-29T20:00:00',
            '2026-05-29T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377541',
            '7a85c44f8d4d6a4108a7217c41911d9f9202025_3:08:12_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-06-01T20:00:00',
            '2026-06-01T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377542',
            'b947aa8b5601e6c0358cd1e8d78b63759202025_3:08:14_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-06-03T20:00:00',
            '2026-06-03T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377543',
            '5016f737b14d5be6bf979b5c70a24f759202025_3:08:16_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-06-05T19:00:00',
            '2026-06-05T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377902',
            '47dfbd24242a8cb93519beb9fa07fa3410142025_4:17:22_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-06-05T20:00:00',
            '2026-06-05T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377544',
            'e8c81836b96ff6005a5f6d3ca5b5c22d9202025_3:08:18_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-06-08T20:00:00',
            '2026-06-08T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377545',
            '6e0a115699a6361fd402062cc37fdf969202025_3:08:20_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-06-10T20:00:00',
            '2026-06-10T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377546',
            'c53044f5614757d56d3c425126d3b1cf9202025_3:08:22_PM',
            true,
            now(),
            now()
        ),
        (
            'GrayHats Cybersecurity Weekly Meeting',
            NULL,
            'INV-140, 18115 Campus Way NE, Bothell, WA 98011, United States',
            '2026-06-12T19:00:00',
            '2026-06-12T23:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Meeting',
            'https://gather.uwb.edu/rsvp?id=377903',
            'c9c45157ef3a6e9704d27439dea7036a10142025_4:17:23_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-06-12T20:00:00',
            '2026-06-12T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377547',
            'bd1079791e3c9de84f9917378bb82ae19202025_3:08:23_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-06-15T20:00:00',
            '2026-06-15T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377548',
            '0740676a7e2ca50fc5cd2c7502464bb49202025_3:08:25_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-06-17T20:00:00',
            '2026-06-17T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377549',
            '9d1fc8167656027fc495cbeeccc74a029202025_3:08:27_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-06-19T20:00:00',
            '2026-06-19T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377550',
            '65bbe831ac333d824b5e2fafc62f06249202025_3:08:29_PM',
            true,
            now(),
            now()
        ),
        (
            'UW Bothell Study Abroad Ambassador Scholarship',
            NULL,
            'TBA',
            '2026-06-20T06:55:00',
            '2026-06-20T06:55:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Application Deadline',
            'https://gather.uwb.edu/rsvp?id=377215',
            '2542b7c99cc1128f94abd6d07e6ab9cf6182025_1:33:54_AM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-06-22T20:00:00',
            '2026-06-22T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377551',
            '6109a9fd05ae5b89fc92f8f7d55d14999202025_3:08:31_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-06-24T20:00:00',
            '2026-06-24T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377552',
            '72c50298adcb79b4d64499194af3ce6e9202025_3:08:33_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-06-26T20:00:00',
            '2026-06-26T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377553',
            '9468df1ee4f67d5b5f54b11244a4b1f79202025_3:08:35_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-06-29T20:00:00',
            '2026-06-29T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377554',
            'd307c5768c734913674552538e27f98a9202025_3:08:37_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-01T20:00:00',
            '2026-07-01T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377555',
            'af53a898d2fc7bc9aaa58e7e9e0ab6af9202025_3:08:39_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-03T20:00:00',
            '2026-07-03T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377556',
            '0fe325319ff38d3d744856eb4409adee9202025_3:08:40_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-06T20:00:00',
            '2026-07-06T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377557',
            'a625f3cea7abc9dd8c2742c9f1d4ac129202025_3:08:43_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-08T20:00:00',
            '2026-07-08T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377558',
            '37e151d6fe08436c626f6c859292283e9202025_3:08:44_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-10T20:00:00',
            '2026-07-10T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377559',
            '5a50d584e8232540272e8c91ec63aab19202025_3:08:46_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-13T20:00:00',
            '2026-07-13T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377560',
            '448cd3045db358738cab985c5c0254bf9202025_3:08:48_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-15T20:00:00',
            '2026-07-15T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377561',
            'a4162eaee7153a809b131917135f79759202025_3:08:50_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-17T20:00:00',
            '2026-07-17T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377562',
            '352f8d69b8c3eda7890627d691d72b279202025_3:08:52_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-20T20:00:00',
            '2026-07-20T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377563',
            '1be28fd8ff7de1a6e7c958554df498fc9202025_3:08:53_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-22T20:00:00',
            '2026-07-22T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377564',
            '1bdce6001a1282429313f61fd383a1849202025_3:08:55_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-24T20:00:00',
            '2026-07-24T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377565',
            'b8e22e8ccf6b6ac611b8926c024cf8fa9202025_3:08:57_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-27T20:00:00',
            '2026-07-27T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377566',
            'ce60902ecf0c11fea86dec572673a6c49202025_3:08:59_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-29T20:00:00',
            '2026-07-29T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377567',
            '0aa1f10bf6e4e0beb9e518cdddf920e69202025_3:09:01_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-07-31T20:00:00',
            '2026-07-31T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377568',
            '5b25b88079222a263196280e6696bb719202025_3:09:02_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-01T20:00:00',
            '2026-09-01T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377569',
            '5a0602eb2800868fa77039b52c155db79202025_3:09:04_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-02T20:00:00',
            '2026-09-02T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377570',
            'e1f90c1ec45819bc2e3c721fdceda5869202025_3:09:06_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-03T20:00:00',
            '2026-09-03T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377571',
            'bb4e509a0e096b6adc7eb03a6bd0c2289202025_3:09:08_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-04T20:00:00',
            '2026-09-04T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377572',
            '9645b6e5fbf43248abf6bc23808dc8779202025_3:09:10_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-05T20:00:00',
            '2026-09-05T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377573',
            'ad5a4552a81381834c46b791696806a79202025_3:09:12_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-06T20:00:00',
            '2026-09-06T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377574',
            'c24baa0697f066018ad46b5fc66b1f349202025_3:09:14_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-07T20:00:00',
            '2026-09-07T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377575',
            '813e9595c8d4c82e49a99d00a462a6689202025_3:09:16_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-08T20:00:00',
            '2026-09-08T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377576',
            'deea0375942fd72391c509021ed8f20b9202025_3:09:17_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-09T20:00:00',
            '2026-09-09T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377577',
            'df21b336af9ee77c4dce3c1ef0fe881c9202025_3:09:19_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-10T20:00:00',
            '2026-09-10T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377578',
            'b376522b85507c617b1888fbb8ac31b49202025_3:09:20_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-11T20:00:00',
            '2026-09-11T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377579',
            '3af01cc512982c9675139a7ab611e6aa9202025_3:09:22_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-12T20:00:00',
            '2026-09-12T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377580',
            '94011616b709350f038bbf166c066e0d9202025_3:09:24_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-13T20:00:00',
            '2026-09-13T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377581',
            '4603c72326324b95a51f4b671b92f67c9202025_3:09:25_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-14T20:00:00',
            '2026-09-14T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377582',
            '25e3444e577f88433a69bc615ce4ca4a9202025_3:09:27_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-15T20:00:00',
            '2026-09-15T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377583',
            '1aaf767ab7e6a019aaa2dd9ecc9249ea9202025_3:09:29_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-16T20:00:00',
            '2026-09-16T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377584',
            '415756833a7acb59e32cd646860ad7029202025_3:09:30_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-17T20:00:00',
            '2026-09-17T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377585',
            '4e9cdd42cf13e8ba1fba0a015a60c94f9202025_3:09:32_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-18T20:00:00',
            '2026-09-18T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377586',
            '5c3681812f671dc94935e90be3b42ba29202025_3:09:34_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-19T20:00:00',
            '2026-09-19T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377587',
            '1329dace4c76379c0b722792d8e2e28e9202025_3:09:36_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-20T20:00:00',
            '2026-09-20T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377588',
            '6bf47a79c845bc8f02f72519b34732ac9202025_3:09:38_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-21T20:00:00',
            '2026-09-21T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377589',
            'c0e076b1b7eac77d20ce76a554a8f5f79202025_3:09:40_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-22T20:00:00',
            '2026-09-22T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377590',
            'a17bff690ce533a89f23b6e1dc16a7039202025_3:09:42_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-23T20:00:00',
            '2026-09-23T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377591',
            '1a190c7b90a4d40d648dd2ca36dc3a439202025_3:09:44_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-24T20:00:00',
            '2026-09-24T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377592',
            'df538eac638df395cc34a91f764684ff9202025_3:09:45_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-25T20:00:00',
            '2026-09-25T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377593',
            'c49d8048a1516e658bd3d12a6d7e5f8e9202025_3:09:47_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-26T20:00:00',
            '2026-09-26T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377594',
            'f275194e6100d842490e0b5482a787c99202025_3:09:49_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-27T20:00:00',
            '2026-09-27T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377595',
            'b1eb38e243558634ba805af5ebc945df9202025_3:09:50_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-28T20:00:00',
            '2026-09-28T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377596',
            'ecd458e28fbeee176020ad62b7baffca9202025_3:09:52_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-29T20:00:00',
            '2026-09-29T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377597',
            '0949282c3638b38eb10510a54c936bff9202025_3:09:54_PM',
            true,
            now(),
            now()
        ),
        (
            'UWAVE Song Request',
            NULL,
            'TBA',
            '2026-09-30T20:00:00',
            '2026-09-30T20:00:00',
            system_user_id,
            'https://gather.uwb.edu/images/default_event_image.png',
            'Social',
            'https://gather.uwb.edu/rsvp?id=377598',
            '79d10df9f4d937ba7a870ee7a7b0dae49202025_3:09:56_PM',
            true,
            now(),
            now()
        );

    RAISE NOTICE 'Successfully inserted % events using creator_id: %', 297, system_user_id;
END $$;

-- Add comment
COMMENT ON TABLE events IS 'Contains both user-created events and official UWB events';



-- =====================================================
-- STORAGE POLICIES FOR PROFILE IMAGES
-- =====================================================

-- Enable public read access for profile images
CREATE POLICY "Public read access for profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');

-- Allow authenticated users to upload profile images to their own folder
CREATE POLICY "Authenticated users can upload profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own profile images
CREATE POLICY "Users can update their own profile images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own profile images
CREATE POLICY "Users can delete their own profile images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Add comment
COMMENT ON POLICY "Public read access for profile images" ON storage.objects IS 'Allows public access to view profile images';
COMMENT ON POLICY "Authenticated users can upload profile images" ON storage.objects IS 'Authenticated users can upload images to their own folder (userId/filename.jpg)';
COMMENT ON POLICY "Users can update their own profile images" ON storage.objects IS 'Users can only update images in their own folder';
COMMENT ON POLICY "Users can delete their own profile images" ON storage.objects IS 'Users can only delete images in their own folder';

-- =====================================================
-- TABLE: conversations
-- Description: Tracks DM conversations between connected users
-- =====================================================

CREATE TABLE IF NOT EXISTS conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    participant1_id uuid NOT NULL,
    participant2_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_message_at timestamp with time zone DEFAULT now(),
    UNIQUE(participant1_id, participant2_id),
    CONSTRAINT conversations_participant1_fkey FOREIGN KEY (participant1_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    CONSTRAINT conversations_participant2_fkey FOREIGN KEY (participant2_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    CONSTRAINT conversations_no_self_conversation CHECK (participant1_id != participant2_id)
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversations_participant1 ON conversations(participant1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participant2 ON conversations(participant2_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message ON conversations(last_message_at DESC);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "Users can view their own conversations" ON conversations
    FOR SELECT
    TO authenticated
    USING (participant1_id = auth.uid() OR participant2_id = auth.uid());

CREATE POLICY "Users can create conversations with connections" ON conversations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        participant1_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM connections
            WHERE status = 'accepted' AND (
                (user_id = participant1_id AND connected_user_id = participant2_id) OR
                (user_id = participant2_id AND connected_user_id = participant1_id)
            )
        )
    );

CREATE POLICY "Users can update their own conversations" ON conversations
    FOR UPDATE
    TO authenticated
    USING (participant1_id = auth.uid() OR participant2_id = auth.uid());

-- =====================================================
-- TABLE: direct_messages
-- Description: Stores direct messages between users
-- =====================================================

CREATE TABLE IF NOT EXISTS direct_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT direct_messages_conversation_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT direct_messages_sender_fkey FOREIGN KEY (sender_id) REFERENCES user_profiles(id) ON DELETE CASCADE,
    CONSTRAINT direct_messages_receiver_fkey FOREIGN KEY (receiver_id) REFERENCES user_profiles(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation ON direct_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_sender ON direct_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_receiver ON direct_messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_direct_messages_created ON direct_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_direct_messages_is_read ON direct_messages(is_read);

-- Enable RLS
ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for direct_messages
CREATE POLICY "Users can view their own messages" ON direct_messages
    FOR SELECT
    TO authenticated
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send messages in their conversations" ON direct_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid() AND
        EXISTS (
            SELECT 1 FROM conversations
            WHERE id = conversation_id AND (
                participant1_id = auth.uid() OR participant2_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update their own messages" ON direct_messages
    FOR UPDATE
    TO authenticated
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can delete their own messages" ON direct_messages
    FOR DELETE
    TO authenticated
    USING (sender_id = auth.uid());

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update conversation's last_message_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE conversations
    SET
        last_message_at = NEW.created_at,
        updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation timestamp when a new message is sent
DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON direct_messages;
CREATE TRIGGER trigger_update_conversation_timestamp
    AFTER INSERT ON direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_timestamp();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update updated_at for conversations
DROP TRIGGER IF EXISTS trigger_conversations_updated_at ON conversations;
CREATE TRIGGER trigger_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers to update updated_at for direct_messages
DROP TRIGGER IF EXISTS trigger_direct_messages_updated_at ON direct_messages;
CREATE TRIGGER trigger_direct_messages_updated_at
    BEFORE UPDATE ON direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- GROUP CHAT TABLES
-- =====================================================
-- Description: Private group chat functionality
-- This allows users to create group chats with their connections

-- Table: group_conversations
-- Description: Stores private group chat conversations
CREATE TABLE IF NOT EXISTS group_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text,
    created_by uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_message_at timestamp with time zone
);

-- Indexes for group_conversations
CREATE INDEX IF NOT EXISTS idx_group_conversations_created_by ON group_conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_group_conversations_last_message ON group_conversations(last_message_at DESC);

-- Table: group_chat_members
-- Description: Maps users to group conversations they're part of
CREATE TABLE IF NOT EXISTS group_chat_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_conversation_id uuid NOT NULL REFERENCES group_conversations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_read_at timestamp with time zone,
    UNIQUE(group_conversation_id, user_id)
);

-- Indexes for group_chat_members
CREATE INDEX IF NOT EXISTS idx_group_chat_members_conversation ON group_chat_members(group_conversation_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_members_user ON group_chat_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_members_user_conversation ON group_chat_members(user_id, group_conversation_id);

-- Table: group_messages
-- Description: Stores messages in group conversations
CREATE TABLE IF NOT EXISTS group_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    group_conversation_id uuid NOT NULL REFERENCES group_conversations(id) ON DELETE CASCADE,
    sender_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for group_messages
CREATE INDEX IF NOT EXISTS idx_group_messages_conversation ON group_messages(group_conversation_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_sender ON group_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_created ON group_messages(created_at DESC);

-- =====================================================
-- RLS POLICIES FOR GROUP CONVERSATIONS
-- =====================================================

ALTER TABLE group_conversations ENABLE ROW LEVEL SECURITY;

-- Allow users to view group conversations they created OR are members of
CREATE POLICY "Users can view their group conversations" ON group_conversations
    FOR SELECT
    TO authenticated
    USING (
        created_by = auth.uid()
        OR id IN (
            SELECT group_conversation_id
            FROM group_chat_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create group conversations" ON group_conversations
    FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "Group creators can update their group conversations" ON group_conversations
    FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid());

CREATE POLICY "Group creators can delete their group conversations" ON group_conversations
    FOR DELETE
    TO authenticated
    USING (created_by = auth.uid());

-- =====================================================
-- RLS POLICIES FOR GROUP CHAT MEMBERS
-- =====================================================

ALTER TABLE group_chat_members ENABLE ROW LEVEL SECURITY;

-- Allow viewing all members of a group (simpler policy to avoid recursion)
CREATE POLICY "Users can view group members" ON group_chat_members
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow creators and the user themselves to add members
CREATE POLICY "Add group members" ON group_chat_members
    FOR INSERT
    TO authenticated
    WITH CHECK (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_conversations
            WHERE group_conversations.id = group_chat_members.group_conversation_id
            AND group_conversations.created_by = auth.uid()
        )
    );

CREATE POLICY "Users can update their own membership" ON group_chat_members
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can remove themselves from group chats" ON group_chat_members
    FOR DELETE
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM group_conversations
            WHERE group_conversations.id = group_chat_members.group_conversation_id
            AND group_conversations.created_by = auth.uid()
        )
    );

-- =====================================================
-- RLS POLICIES FOR GROUP MESSAGES
-- =====================================================

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their group conversations" ON group_messages
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM group_chat_members
            WHERE group_chat_members.group_conversation_id = group_messages.group_conversation_id
            AND group_chat_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Group members can send messages" ON group_messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        sender_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM group_chat_members
            WHERE group_chat_members.group_conversation_id = group_messages.group_conversation_id
            AND group_chat_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own messages" ON group_messages
    FOR UPDATE
    TO authenticated
    USING (sender_id = auth.uid());

CREATE POLICY "Users can delete their own messages" ON group_messages
    FOR DELETE
    TO authenticated
    USING (sender_id = auth.uid());

-- =====================================================
-- FUNCTIONS AND TRIGGERS FOR GROUP CHATS
-- =====================================================

-- Function to update group conversation's last_message_at timestamp
CREATE OR REPLACE FUNCTION update_group_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE group_conversations
    SET
        last_message_at = NEW.created_at,
        updated_at = NEW.created_at
    WHERE id = NEW.group_conversation_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update group conversation timestamp when a new message is sent
DROP TRIGGER IF EXISTS trigger_update_group_conversation_timestamp ON group_messages;
CREATE TRIGGER trigger_update_group_conversation_timestamp
    AFTER INSERT ON group_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_group_conversation_timestamp();

-- Triggers to update updated_at for group_conversations
DROP TRIGGER IF EXISTS trigger_group_conversations_updated_at ON group_conversations;
CREATE TRIGGER trigger_group_conversations_updated_at
    BEFORE UPDATE ON group_conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers to update updated_at for group_messages
DROP TRIGGER IF EXISTS trigger_group_messages_updated_at ON group_messages;
CREATE TRIGGER trigger_group_messages_updated_at
    BEFORE UPDATE ON group_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
