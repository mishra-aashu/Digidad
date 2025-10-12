// =====================================================
// DIGIDAD MESSAGING APP - SUPABASE CONFIGURATION
// =====================================================
// Update these values with your actual Supabase project credentials

const SUPABASE_CONFIG = {
  // Your Supabase project URL (found in Project Settings > API)
  SUPABASE_URL: 'https://mfigbwrmcmbipvkwqtsr.supabase.co',

  // Your Supabase anon/public key (found in Project Settings > API)
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1maWdid3JtY21iaXB2a3dxdHNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2ODg1MjcsImV4cCI6MjA3NTI2NDUyN30.D7OmCYbHa3XUyqPWG4sxxKORP_jiWW9TqOSECAvazTE',

  // Database schema configuration
  DATABASE: {
    TABLES: {
      USERS: 'users',
      MESSAGES: 'messages',
      CONTACTS: 'contacts',
      USER_CHATS: 'user_chats',
      CHAT_SETTINGS: 'chat_settings',
      CONTACT_ALIASES: 'contact_aliases',
      PROFILES: 'profiles'
    }
  },

  // Real-time configuration
  REALTIME: {
    CHANNELS: {
      MESSAGES: 'messages',
      USER_STATUS: 'user_status',
      TYPING: 'typing'
    }
  },

  // Storage configuration for file uploads
  STORAGE: {
    BUCKETS: {
      PROFILE_PICTURES: 'profile-pictures',
      CHAT_FILES: 'chat-files'
    }
  }
};

// Export for use in other files
window.SUPABASE_CONFIG = SUPABASE_CONFIG;