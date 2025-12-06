/**
 * Script to check for invalid club image URLs
 * This script tests all image URLs in the database and reports which ones return 404 errors
 *
 * Usage: npm run check-images
 */

// Load environment variables from .env file
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://iscmplnqubcbyflspsmi.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkInvalidImages() {
  console.log('🔍 Checking for invalid club images...\n');

  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in environment variables.');
    console.error('Please add it to your .env file.');
    return;
  }

  // Create Supabase client with service role key (bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('Connecting to Supabase with service role...');
    console.log(`URL: ${SUPABASE_URL}`);

    // Get all groups with image URLs (both clubs and study groups)
    const { data: clubs, error, count } = await supabase
      .from('groups')
      .select('id, name, image_url, is_official_club', { count: 'exact' })
      .order('name');

    console.log(`\nQuery completed.`);
    console.log(`Count: ${count}`);
    console.log(`Data length: ${clubs ? clubs.length : 0}`);

    if (error) {
      console.error('❌ Error fetching clubs:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      return;
    }

    if (!clubs || clubs.length === 0) {
      console.log('\n⚠️  No groups found in database.');
      return;
    }

    // Filter to only groups that have image URLs
    const clubsWithImages = clubs.filter(club => club.image_url && club.image_url.trim().length > 0);

    if (clubsWithImages.length === 0) {
      console.log(`Found ${clubs.length} total groups, but none have image URLs.`);
      return;
    }

    console.log(`Found ${clubsWithImages.length} groups with image URLs. Testing...\n`);

    const invalidClubs = [];
    const validClubs = [];
    const errors = [];

    // Test each image URL
    for (let i = 0; i < clubsWithImages.length; i++) {
      const club = clubsWithImages[i];
      const progress = `[${i + 1}/${clubsWithImages.length}]`;

      try {
        // Use HEAD request for faster checking (doesn't download the image)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(club.image_url, {
          method: 'HEAD',
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.status === 404) {
          console.log(`${progress} ❌ 404 - ${club.name}`);
          invalidClubs.push(club);
        } else if (response.status >= 400) {
          console.log(`${progress} ⚠️  ${response.status} - ${club.name}`);
          invalidClubs.push(club);
        } else {
          console.log(`${progress} ✓ ${club.name}`);
          validClubs.push(club);
        }
      } catch (error) {
        console.log(`${progress} ⚠️  Error - ${club.name}: ${error.message}`);
        errors.push({ club, error: error.message });
      }

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total groups checked: ${clubsWithImages.length}`);
    console.log(`✓ Valid images: ${validClubs.length}`);
    console.log(`❌ Invalid images: ${invalidClubs.length}`);
    console.log(`⚠️  Errors/Timeouts: ${errors.length}`);

    // Print detailed list of invalid clubs
    if (invalidClubs.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('❌ CLUBS WITH INVALID IMAGES');
      console.log('='.repeat(60));
      invalidClubs.forEach(club => {
        console.log(`\nID: ${club.id}`);
        console.log(`Name: ${club.name}`);
        console.log(`URL: ${club.image_url}`);
      });

      // Print SQL to fix them
      console.log('\n' + '='.repeat(60));
      console.log('🔧 SQL TO FIX (copy and run in Supabase SQL Editor)');
      console.log('='.repeat(60));
      const ids = invalidClubs.map(c => `'${c.id}'`).join(', ');
      console.log(`\nUPDATE groups`);
      console.log(`SET image_url = NULL`);
      console.log(`WHERE id IN (${ids});`);
      console.log('');
    } else {
      console.log('\n✅ All image URLs are valid!');
    }

    // Print clubs that had errors
    if (errors.length > 0) {
      console.log('\n' + '='.repeat(60));
      console.log('⚠️  CLUBS WITH ERRORS (may need manual check)');
      console.log('='.repeat(60));
      errors.forEach(({ club, error }) => {
        console.log(`\nName: ${club.name}`);
        console.log(`URL: ${club.image_url}`);
        console.log(`Error: ${error}`);
      });
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
checkInvalidImages().then(() => {
  console.log('\n✅ Script completed.');
}).catch((error) => {
  console.error('❌ Script failed:', error);
});
