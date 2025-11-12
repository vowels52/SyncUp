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

CREATE POLICY "Users can delete their own connections" ON connections
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

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
