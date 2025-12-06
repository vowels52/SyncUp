/**
 * Script to find and clean invalid text data in groups table
 * Finds entries with problematic values like ".", single characters, or empty strings
 * that cause "Unexpected text node" errors in React Native
 *
 * Usage: npm run clean-text
 */

// Load environment variables from .env file
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://iscmplnqubcbyflspsmi.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Fields to check for invalid text
const TEXT_FIELDS = ['club_type', 'category', 'description'];

// Check if a value is invalid (should be NULL instead)
function isInvalidText(value) {
  if (!value) return false; // NULL or empty is fine
  if (typeof value !== 'string') return true; // Non-string values are invalid

  const trimmed = value.trim();

  // Invalid if:
  // - Just whitespace
  // - Single character (especially ".")
  // - Only punctuation
  // - Less than 2 characters
  // - Contains only dots, commas, or other punctuation
  return (
    trimmed.length === 0 ||
    trimmed.length === 1 ||
    trimmed === '.' ||
    trimmed === '..' ||
    /^[^\w\s]+$/.test(trimmed) || // Only punctuation
    /^\.+$/.test(trimmed) // Only dots
  );
}

async function cleanInvalidText() {
  console.log('🔍 Checking for invalid text data in groups table...\n');

  if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: SUPABASE_SERVICE_ROLE_KEY not found in environment variables.');
    console.error('Please add it to your .env file.');
    return;
  }

  // Create Supabase client with service role key (bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    console.log('Connecting to Supabase with service role...');
    console.log(`URL: ${SUPABASE_URL}\n`);

    // Get all groups (focusing on official clubs since that's where the error appears)
    const { data: groups, error } = await supabase
      .from('groups')
      .select('id, name, club_type, category, description, is_official_club')
      .eq('is_official_club', true)
      .order('name');

    if (error) {
      console.error('❌ Error fetching groups:', error);
      return;
    }

    if (!groups || groups.length === 0) {
      console.log('⚠️  No groups found in database.');
      return;
    }

    console.log(`Found ${groups.length} official clubs. Analyzing...\n`);

    // Also show first 10 clubs to help identify which one causes issues
    console.log('First 10 clubs (in order):');
    groups.slice(0, 10).forEach((club, index) => {
      console.log(`  ${index + 1}. ${club.name}`);
      if (club.club_type) console.log(`     club_type: "${club.club_type}"`);
      if (club.category) console.log(`     category: "${club.category}"`);
    });
    console.log('');

    const problematicGroups = [];
    const updatesByGroup = {};

    // Check each group for invalid text
    for (const group of groups) {
      const issues = [];
      const updates = {};

      TEXT_FIELDS.forEach(field => {
        if (isInvalidText(group[field])) {
          issues.push({
            field,
            value: group[field],
            displayValue: group[field] ? `"${group[field]}"` : 'empty'
          });
          updates[field] = null;
        }
      });

      if (issues.length > 0) {
        problematicGroups.push({
          ...group,
          issues,
          updates
        });
        updatesByGroup[group.id] = updates;
      }
    }

    // Print summary
    console.log('='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total groups checked: ${groups.length}`);
    console.log(`✓ Clean groups: ${groups.length - problematicGroups.length}`);
    console.log(`❌ Groups with invalid text: ${problematicGroups.length}`);

    if (problematicGroups.length === 0) {
      console.log('\n✅ All groups have valid text data!');
      return;
    }

    // Print detailed list of problematic groups
    console.log('\n' + '='.repeat(60));
    console.log('❌ GROUPS WITH INVALID TEXT DATA');
    console.log('='.repeat(60));

    problematicGroups.forEach(group => {
      console.log(`\nID: ${group.id}`);
      console.log(`Name: ${group.name}`);
      console.log(`Type: ${group.is_official_club ? 'Official Club' : 'Study Group'}`);
      console.log('Issues:');
      group.issues.forEach(issue => {
        console.log(`  - ${issue.field}: ${issue.displayValue}`);
      });
    });

    // Generate SQL to fix all issues
    console.log('\n' + '='.repeat(60));
    console.log('🔧 SQL TO FIX ALL ISSUES');
    console.log('='.repeat(60));
    console.log('\n-- Option 1: Fix all at once');

    TEXT_FIELDS.forEach(field => {
      const affectedGroups = problematicGroups.filter(g =>
        g.issues.some(i => i.field === field)
      );

      if (affectedGroups.length > 0) {
        const ids = affectedGroups.map(g => `'${g.id}'`).join(', ');
        console.log(`\n-- Clear invalid ${field} values (${affectedGroups.length} groups)`);
        console.log(`UPDATE groups`);
        console.log(`SET ${field} = NULL`);
        console.log(`WHERE id IN (${ids});`);
      }
    });

    // Alternative: single update per group
    console.log('\n\n-- Option 2: Individual updates per group');
    problematicGroups.slice(0, 5).forEach(group => {
      const setClause = Object.keys(group.updates)
        .map(field => `${field} = NULL`)
        .join(', ');
      console.log(`\nUPDATE groups SET ${setClause} WHERE id = '${group.id}';`);
    });

    if (problematicGroups.length > 5) {
      console.log(`\n-- ... and ${problematicGroups.length - 5} more groups`);
    }

    // Show statistics by field
    console.log('\n' + '='.repeat(60));
    console.log('📈 STATISTICS BY FIELD');
    console.log('='.repeat(60));

    TEXT_FIELDS.forEach(field => {
      const count = problematicGroups.filter(g =>
        g.issues.some(i => i.field === field)
      ).length;

      if (count > 0) {
        console.log(`${field}: ${count} groups need cleaning`);

        // Show common invalid values
        const values = {};
        problematicGroups.forEach(g => {
          const issue = g.issues.find(i => i.field === field);
          if (issue) {
            const val = issue.displayValue;
            values[val] = (values[val] || 0) + 1;
          }
        });

        console.log('  Common values:');
        Object.entries(values)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([val, count]) => {
            console.log(`    ${val}: ${count} occurrences`);
          });
      }
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
cleanInvalidText().then(() => {
  console.log('\n✅ Script completed.');
}).catch((error) => {
  console.error('❌ Script failed:', error);
});
