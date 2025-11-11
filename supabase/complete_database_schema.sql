-- OnSpace Cloud - SyncUp Database Schema
-- Generated from OnSpace.AI schema on 2025-11-05
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
