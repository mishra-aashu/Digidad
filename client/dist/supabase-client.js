// =====================================================
// DIGIDAD MESSAGING APP - SUPABASE CLIENT LIBRARY
// =====================================================
// This file provides a complete client library for interacting with Supabase
// It replaces the Google Apps Script backend with modern database operations

class SupabaseClient {
    constructor() {
        this.supabase = null;
        this.isInitialized = false;
        this.currentUser = null;
        this.realtimeChannels = new Map();
        this.initializationError = null; // Store initialization error
        this.isInitializing = false;

        // Only auto-initialize if not already created
        if (!SupabaseClient.instance) {
            this.initializeClient();
        }
    }

    // Singleton pattern
    static getInstance() {
        if (!SupabaseClient.instance) {
            SupabaseClient.instance = new SupabaseClient();
        }
        return SupabaseClient.instance;
    }

    /**
     * Initialize the Supabase client
     */
    async initializeClient() {
        // Prevent multiple simultaneous initialization attempts
        if (this.isInitializing) {
            console.log('⏳ Supabase client initialization already in progress...');
            // Wait for existing initialization to complete (max 2 seconds)
            let retries = 0;
            while (this.isInitializing && retries < 20) {
                await new Promise(resolve => setTimeout(resolve, 100));
                retries++;
            }
            // If another process failed, throw its error
            if (this.initializationError) {
                throw this.initializationError;
            }
            // If another process succeeded, return
            else if (this.isInitialized) {
                return;
            }
            throw new Error('Initialization timeout');
        }

        if (this.isInitialized) {
            console.log('✅ Supabase client already initialized');
            return;
        }

        this.isInitializing = true;
        this.initializationError = null; // Reset error on new attempt

        try {
            // Load Supabase dynamically if not already loaded
            if (typeof window.supabase === 'undefined') {
                console.log('📥 Loading Supabase library...');

                // Load supabase-config.js first if not loaded
                if (typeof window.SUPABASE_CONFIG === 'undefined') {
                    console.log('📥 Loading supabase-config.js...');
                    try {
                        await this.loadScript('/supabase-config.js');
                        console.log('✅ supabase-config.js loaded');
                    } catch (error) {
                        console.error('❌ Failed to load supabase-config.js:', error);
                        throw new Error('Configuration file not loaded');
                    }
                }

                // Load Supabase script dynamically
                await this.loadSupabaseScript();

                // Wait for it to be available (max 3 seconds)
                let retries = 0;
                const maxRetries = 30;

                while (typeof window.supabase === 'undefined' && retries < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    retries++;
                }
            }

            if (typeof window.supabase === 'undefined') {
                console.error('❌ Supabase library not loaded. Please check your internet connection.');
                console.error('❌ Available window properties:', Object.keys(window).filter(key => key.includes('supabase')));
                throw new Error('Supabase library not loaded');
            }

            console.log('✅ Supabase library loaded successfully');

            // Validate configuration
            console.log('🔍 Validating Supabase configuration...');
            console.log('🔍 SUPABASE_CONFIG:', SUPABASE_CONFIG);
            if (!SUPABASE_CONFIG.SUPABASE_URL || !SUPABASE_CONFIG.SUPABASE_ANON_KEY) {
                console.error('❌ Supabase configuration is missing. Please check SUPABASE_CONFIG.');
                console.log('SUPABASE_URL:', SUPABASE_CONFIG.SUPABASE_URL ? '✅ Set' : '❌ Missing');
                console.log('SUPABASE_ANON_KEY:', SUPABASE_CONFIG.SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
                throw new Error('Invalid Supabase configuration');
            }
            console.log('✅ Supabase configuration validated');

            // Create Supabase client
            this.supabase = window.supabase.createClient(
                SUPABASE_CONFIG.SUPABASE_URL,
                SUPABASE_CONFIG.SUPABASE_ANON_KEY,
                {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false,
                        detectSessionInUrl: false
                    },
                    global: {
                        headers: {
                            'apikey': SUPABASE_CONFIG.SUPABASE_ANON_KEY
                        }
                    },
                    realtime: {
                        params: {
                            eventsPerSecond: 10,
                        },
                    },
                }
            );

            // Test connection
            console.log('🔍 Testing database connection...');

            // Try direct fetch first to test basic connectivity
            try {
                console.log('🔍 Testing direct fetch connectivity...');
                const testResponse = await fetch(
                    `${SUPABASE_CONFIG.SUPABASE_URL}/rest/v1/`,
                    {
                        method: 'GET',
                        headers: {
                            'apikey': SUPABASE_CONFIG.SUPABASE_ANON_KEY
                        }
                    }
                );
                console.log('🔍 Direct fetch test status:', testResponse.status);
            } catch (fetchError) {
                console.warn('⚠️ Direct fetch test failed:', fetchError.message);
            }

            const { data, error } = await this.supabase.from('users').select('count').limit(1);
            if (error) {
                if (error.code === 'PGRST116') {
                    // PGRST116 is "no rows returned" - this is normal for empty tables
                    console.log('✅ Database connection successful (empty tables)');
                } else {
                    console.warn('⚠️ Database connection test failed:', error.message);
                    console.log('Error details:', error);
                    console.log('Error code:', error.code);
                    console.log('Error status:', error.status);
                    throw new Error(`Database connection failed: ${error.message}`);
                }
            } else {
                console.log('✅ Database connection successful');
            }

            this.isInitialized = true;
            console.log('✅ Supabase client initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize Supabase client:', error);
            this.isInitialized = false;
            this.initializationError = error; // Store the error
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    /**
      * Load script dynamically
      */
    async loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
      * Load Supabase script dynamically with fallback options
      */
    async loadSupabaseScript() {
        return new Promise((resolve, reject) => {
            // Check if already loaded
            if (typeof window.supabase !== 'undefined') {
                console.log('✅ Supabase already loaded');
                resolve();
                return;
            }

            // Check if script is already in DOM and loaded
            const existingScript = document.querySelector('script[src*="supabase-js"]');
            if (existingScript) {
                console.log('📋 Supabase script already in DOM, waiting for load...');
                // Wait for it to load with timeout
                let retries = 0;
                const checkInterval = setInterval(() => {
                    if (typeof window.supabase !== 'undefined') {
                        clearInterval(checkInterval);
                        console.log('✅ Supabase script loaded from existing script');
                        resolve();
                    } else if (retries >= 50) { // 5 seconds max wait
                        clearInterval(checkInterval);
                        reject(new Error('Script in DOM but supabase not available after timeout'));
                    }
                    retries++;
                }, 100);
                return;
            }

            // Use a more reliable CDN source first
            const cdnUrls = [
                'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.min.js'
            ];

            let loaded = false;
            let failedCount = 0;

            cdnUrls.forEach((url, index) => {
                if (loaded) return;

                console.log(`📥 Attempting to load Supabase from: ${url}`);

                const script = document.createElement('script');
                script.src = url;
                script.crossOrigin = 'anonymous';

                script.onload = () => {
                    if (!loaded) {
                        loaded = true;
                        console.log('✅ Supabase script loaded successfully from:', url);
                        resolve();
                    }
                };

                script.onerror = (error) => {
                    failedCount++;
                    console.warn(`⚠️ Failed to load Supabase from: ${url}`, error);

                    // If this is the last CDN and all failed, provide helpful error message
                    if (failedCount === cdnUrls.length) {
                        const errorMsg = `
🚫 SUPABASE CDN LOADING FAILED

This is likely due to one of these issues:
1. 🔒 CORS Policy - Your browser is blocking CDN resources
2. 🌐 Network/Firewall - CDN domains are blocked
3. 📶 Internet Connection - Cannot reach CDN servers

💡 SOLUTIONS:
• Use HTTPS instead of HTTP for your local server
• Check if your firewall/antivirus allows CDN access
• Try using a different browser
• Or run: python -m http.server 8080 (instead of Live Server)

For development, you can also temporarily disable CORS in your browser.
                        `.trim();

                        console.error(errorMsg);
                        reject(new Error(`CDN loading failed. See console for solutions.`));
                    }
                };

                document.head.appendChild(script);
            });
        });
    }

    /**
     * Ensure client is initialized before making requests
     */
    async ensureInitialized() {
        // If initialization previously failed, throw the stored error immediately
        if (this.initializationError && !this.isInitialized) {
            throw this.initializationError;
        }

        if (!this.isInitialized) {
            await this.initializeClient();
        }
        if (!this.isInitialized) {
            throw new Error('Supabase client failed to initialize');
        }
    }

    // =====================================================
    // AUTHENTICATION METHODS
    // =====================================================

    /**
       * Sign up a new user with phone number
       */
    async signUp(phone, name = null, email = null) {
        await this.ensureInitialized();

        try {
            console.log('📝 Creating new user in Supabase:', { phone, name, email });
            console.log('🔧 Using anon key for registration');

            // First, create the user in the users table (this should work with updated RLS policy)
            const { data, error } = await this.supabase
                .from('users')
                .insert({
                    phone: phone,
                    name: name,
                    email: email,
                    is_online: true,
                    last_seen: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.log('❌ User creation failed:', error);

                // Handle RLS policy violations more gracefully
                if (error.code === '42501' || error.message.includes('row-level security')) {
                    console.log('🔒 RLS Policy violation - trying alternative approach...');

                    // Try to find existing user first
                    const { data: existingUser, error: findError } = await this.supabase
                        .from('users')
                        .select('*')
                        .eq('phone', phone)
                        .single();

                    if (existingUser && !findError) {
                        console.log('✅ Found existing user:', existingUser.id);
                        this.currentUser = existingUser;
                        return { status: 'success', user: existingUser };
                    }

                    // If user doesn't exist, this is a real RLS issue
                    console.error('❌ RLS Policy blocking user creation. Please check database policies.');
                    return {
                        status: 'error',
                        message: 'Registration blocked by security policy. Please contact support or check database configuration.'
                    };
                }

                // Handle unique violations (user already exists)
                if (error.code === '23505') { // unique_violation
                    console.log('✅ User already exists, fetching existing user...');
                    const { data: existingUser, error: findError } = await this.supabase
                        .from('users')
                        .select('*')
                        .eq('phone', phone)
                        .single();

                    if (existingUser && !findError) {
                        console.log('✅ Found existing user:', existingUser.id);
                        this.currentUser = existingUser;
                        return { status: 'success', user: existingUser };
                    } else {
                        console.error('❌ Error finding existing user:', findError);
                    }
                }

                // Re-throw other errors
                throw error;
            }

            // Create profile
            const { error: profileError } = await this.supabase
                .from('profiles')
                .insert({
                    id: data.id,
                    user_id: data.id,
                    display_name: name || phone,
                    status: 'Hey there! I am using Digidad.'
                });

            if (profileError) {
                console.warn('Profile creation warning:', profileError);
                // Don't fail the whole process if profile creation fails
            }

            this.currentUser = data;
            return { status: 'success', user: data };

        } catch (error) {
            console.error('Sign up error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
      * Sign in existing user
      */
    async signIn(phone) {
        await this.ensureInitialized();

        try {
            console.log('🔐 Looking up user by phone:', phone);

            // Find user by phone
            const { data: user, error: userError } = await this.supabase
                .from('users')
                .select('*')
                .eq('phone', phone)
                .single();

            if (userError && userError.code === 'PGRST116') {
                // If user doesn't exist, create them
                console.log('❌ User not found, creating new user...');
                return await this.signUp(phone);
            }

            if (userError) {
                console.error('❌ User lookup error:', userError);
                console.log('❌ Attempting to create user as fallback...');
                // Try to create user anyway
                return await this.signUp(phone);
            }

            // Update online status
            await this.supabase
                .from('users')
                .update({
                    is_online: true,
                    last_seen: new Date().toISOString()
                })
                .eq('id', user.id);

            this.currentUser = user;
            return { status: 'success', user: user };

        } catch (error) {
            console.error('Sign in error:', error);
            // Fallback: try to create user
            return await this.signUp(phone);
        }
    }

    /**
     * Sign out current user
     */
    async signOut() {
        await this.ensureInitialized();

        try {
            if (this.currentUser) {
                // Update offline status
                await this.supabase
                    .from('users')
                    .update({
                        is_online: false,
                        last_seen: new Date().toISOString()
                    })
                    .eq('id', this.currentUser.id);

                // Close all realtime channels
                this.closeAllRealtimeChannels();
            }

            this.currentUser = null;
            return { status: 'success' };

        } catch (error) {
            console.error('Sign out error:', error);
            return { status: 'error', message: error.message };
        }
    }

    // =====================================================
    // USER MANAGEMENT METHODS
    // =====================================================

    /**
     * Update user profile
     */
    async updateUserProfile(updates) {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            const { data, error } = await this.supabase
                .from('users')
                .update({
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentUser.id)
                .select()
                .single();

            if (error) throw error;

            this.currentUser = data;
            return { status: 'success', user: data };

        } catch (error) {
            console.error('Update profile error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Update user profile (profiles table)
     */
    async updateProfile(updates) {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .upsert({
                    user_id: this.currentUser.id,
                    ...updates,
                    updated_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) throw error;

            return { status: 'success', profile: data };

        } catch (error) {
            console.error('Update profile error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Get user profile with additional info
     */
    async getUserProfile(userId) {
        await this.ensureInitialized();

        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            return { status: 'success', profile: data };

        } catch (error) {
            console.error('Get profile error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
      * Find user by phone number - SMART SEARCH with LIKE queries
      */
    async findUserByPhone(phone) {
        await this.ensureInitialized();

        try {
            console.log('🔍 Searching for user by phone:', phone);

            // Extract only digits from the input
            const digitsOnly = phone.replace(/\D/g, '');
            console.log('📱 Digits only:', digitsOnly);

            // Extract last 10 digits (handles various formats)
            const last10Digits = digitsOnly.slice(-10);
            console.log('📱 Last 10 digits:', last10Digits);

            // Need at least 10 digits to search
            if (last10Digits.length < 10) {
                console.log('❌ Need at least 10 digits, got:', last10Digits.length);
                return { status: 'not_found' };
            }

            console.log('🔍 Searching for users with pattern:', `%${last10Digits}`);

            // Use LIKE query for flexible matching (multiple fallback methods)
            let data, error;

            try {
                // Method 1: Supabase client with LIKE query
                console.log('🔍 Trying Supabase client LIKE query...');
                const result = await this.supabase
                    .from('users')
                    .select('id, phone, name')
                    .like('phone', `%${last10Digits}`)
                    .neq('id', this.currentUser?.id || '00000000-0000-0000-0000-000000000000')
                    .limit(5);

                data = result.data;
                error = result.error;
                console.log('🔍 Supabase LIKE query result:', { data, error });

            } catch (clientError) {
                console.error('❌ Supabase client error:', clientError);

                // Method 2: Direct fetch as fallback
                console.log('🔄 Trying direct fetch fallback...');
                try {
                    const response = await fetch(
                        `${SUPABASE_CONFIG.SUPABASE_URL}/rest/v1/users?select=id,phone,name&phone=like.%25${last10Digits}&id=neq.${this.currentUser?.id || '00000000-0000-0000-0000-000000000000'}&limit=5`,
                        {
                            method: 'GET',
                            headers: {
                                'apikey': SUPABASE_CONFIG.SUPABASE_ANON_KEY,
                                'Authorization': `Bearer ${SUPABASE_CONFIG.SUPABASE_ANON_KEY}`,
                                'Content-Type': 'application/json',
                                'Prefer': 'return=representation'
                            }
                        }
                    );

                    console.log('🔍 Direct fetch status:', response.status);

                    if (response.ok) {
                        data = await response.json();
                        error = null;
                        console.log('✅ Direct fetch successful, found users:', data?.length || 0);
                    } else {
                        console.error('❌ Direct fetch failed:', response.status, response.statusText);
                        if (response.status === 406) {
                            console.error('🚫 406 ERROR - Check Supabase project configuration!');
                        }
                        data = null;
                        error = { status: response.status, message: response.statusText };
                    }
                } catch (fetchError) {
                    console.error('❌ Direct fetch error:', fetchError);
                    data = null;
                    error = fetchError;
                }
            }

            if (error && error.code !== 'PGRST116') {
                console.error('❌ Database error:', error);
                if (error.status === 406) {
                    console.error('🚫 406 ERROR DETECTED!');
                    console.error('SOLUTION: Check Supabase project settings in dashboard');
                }
            }

            if (data && data.length > 0) {
                console.log('✅ Users found:', data.length);
                // Return the first match for now (can be enhanced to return multiple)
                return { status: 'found', user: data[0], allResults: data };
            } else {
                console.log('❌ No users found for pattern:', `%${last10Digits}`);
                return { status: 'not_found' };
            }

        } catch (error) {
            console.error('Find user error:', error);
            return { status: 'error', message: error.message };
        }
    }

    // =====================================================
    // MESSAGING METHODS
    // =====================================================

    /**
     * Send a message
     */
    async sendMessage(toUserId, content, messageType = 'text', replyToMessageId = null, fileData = null) {
        await this.ensureInitialized();

        console.log('📨 SupabaseClient: sendMessage called with:', {
            toUserId,
            content,
            messageType,
            replyToMessageId,
            fileData,
            currentUser: this.currentUser?.id,
            isInitialized: this.isInitialized
        });

        if (!this.currentUser) {
            console.error('❌ SupabaseClient: No authenticated user');
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            const messageData = {
                from_user_id: this.currentUser.id,
                to_user_id: toUserId,
                content: content,
                message_type: messageType,
                reply_to_message_id: replyToMessageId,
                file_url: fileData?.url || null,
                file_name: fileData?.name || null,
                file_size: fileData?.size || null
            };

            console.log('📨 SupabaseClient: Message data prepared:', messageData);

            console.log('📨 SupabaseClient: Executing database insert...');
            const { data, error } = await this.supabase
                .from('messages')
                .insert(messageData)
                .select()
                .single();

            if (error) {
                console.error('❌ SupabaseClient: Database insert failed:', error);
                console.error('❌ SupabaseClient: Error details:', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint
                });
                throw error;
            }

            console.log('✅ SupabaseClient: Message sent successfully:', data);
            return { status: 'sent', message: data };

        } catch (error) {
            console.error('❌ SupabaseClient: Send message error:', error);
            console.error('❌ SupabaseClient: Error stack:', error.stack);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Get messages for a chat
     */
    async getMessages(peerId, options = {}) {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            const {
                limit = 50,
                beforeTimestamp = null,
                afterTimestamp = null,
                includeReplies = true
            } = options;

            // Build query for messages between current user and peer
            let query = this.supabase
                .from('messages')
                .select(`
                    *,
                    reply_to_message:messages!reply_to_message_id(
                        id,
                        content,
                        from_user_id,
                        users!from_user_id(name)
                    )
                `)
                .eq('is_deleted', false)
                .or(`and(from_user_id.eq.${this.currentUser.id},to_user_id.eq.${peerId}),and(from_user_id.eq.${peerId},to_user_id.eq.${this.currentUser.id})`)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (beforeTimestamp) {
                query = query.lt('created_at', beforeTimestamp);
            }

            if (afterTimestamp) {
                query = query.gt('created_at', afterTimestamp);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Mark messages as read (optional - can be implemented later)
            // if (data && data.length > 0) {
            //     await this.markMessagesAsRead(peerId);
            // }

            // Format messages for frontend
            const formattedMessages = data.reverse().map(message => ({
                id: message.id,
                from: message.from_user_id,
                msg: message.content,
                ts: message.created_at,
                seen: true, // Will be updated by realtime
                replyTo: message.reply_to_message ? {
                    id: message.reply_to_message.id,
                    text: message.reply_to_message.content,
                    author: message.reply_to_message.users?.name || 'User'
                } : null,
                messageType: message.message_type,
                fileUrl: message.file_url,
                fileName: message.file_name
            }));

            return {
                status: 'success',
                messages: formattedMessages,
                hasMore: data.length === limit
            };

        } catch (error) {
            console.error('Get messages error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Mark messages as read
     */
    async markMessagesAsRead(peerId) {
        await this.ensureInitialized();

        if (!this.currentUser) return;

        try {
            // Reset unread count in user_chats table
            await this.supabase
                .from('user_chats')
                .update({ unread_count: 0 })
                .eq('owner_id', this.currentUser.id)
                .eq('peer_id', peerId);

        } catch (error) {
            console.error('Mark as read error:', error);
        }
    }

    /**
     * Edit a message
     */
    async editMessage(messageId, newContent) {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            const { data, error } = await this.supabase
                .from('messages')
                .update({
                    content: newContent,
                    is_edited: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', messageId)
                .eq('from_user_id', this.currentUser.id)
                .select()
                .single();

            if (error) throw error;

            return { status: 'success', message: data };

        } catch (error) {
            console.error('Edit message error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Delete a message
     */
    async deleteMessage(messageId) {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            const { error } = await this.supabase
                .from('messages')
                .update({ is_deleted: true })
                .eq('id', messageId)
                .eq('from_user_id', this.currentUser.id);

            if (error) throw error;

            return { status: 'success' };

        } catch (error) {
            console.error('Delete message error:', error);
            return { status: 'error', message: error.message };
        }
    }

    // =====================================================
    // CONTACTS MANAGEMENT METHODS
    // =====================================================

    /**
     * Add a contact
     */
    async addContact(contactName, contactPhone, contactEmail = null) {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            const { data, error } = await this.supabase
                .from('contacts')
                .insert({
                    owner_id: this.currentUser.id,
                    contact_name: contactName,
                    contact_phone: contactPhone,
                    contact_email: contactEmail
                })
                .select();

            if (error) throw error;

            return { status: 'success', contacts: data };

        } catch (error) {
            console.error('Add contact error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Get user contacts
     */
    async getContacts() {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            const { data, error } = await this.supabase
                .from('contacts')
                .select('*')
                .eq('owner_id', this.currentUser.id)
                .order('contact_name');

            if (error) throw error;

            return { status: 'success', contacts: data };

        } catch (error) {
            console.error('Get contacts error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Update contact
     */
    async updateContact(contactId, updates) {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            const { data, error } = await this.supabase
                .from('contacts')
                .update(updates)
                .eq('id', contactId)
                .eq('owner_id', this.currentUser.id)
                .select()
                .single();

            if (error) throw error;

            return { status: 'success', contact: data };

        } catch (error) {
            console.error('Update contact error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Delete contact
     */
    async deleteContact(contactId) {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            const { error } = await this.supabase
                .from('contacts')
                .delete()
                .eq('id', contactId)
                .eq('owner_id', this.currentUser.id);

            if (error) throw error;

            return { status: 'success' };

        } catch (error) {
            console.error('Delete contact error:', error);
            return { status: 'error', message: error.message };
        }
    }

    // =====================================================
    // CHAT MANAGEMENT METHODS
    // =====================================================

    /**
      * Get user chats
      */
    async getUserChats() {
        await this.ensureInitialized();

        console.log('getUserChats called');
        console.log('Current user state:', {
            currentUser: this.currentUser,
            isAuthenticated: this.isAuthenticated()
        });

        if (!this.currentUser) {
            console.error('❌ No authenticated user - currentUser is null');
            return { status: 'error', message: 'No authenticated user' };
        }

        console.log('✅ User is authenticated, proceeding with chat loading');

        try {
            const { data, error } = await this.supabase
                .from('user_chats')
                .select(`
                    *,
                    peer:users!peer_id(
                        id,
                        name,
                        phone
                    )
                `)
                .eq('owner_id', this.currentUser.id)
                .eq('is_archived', false)
                .order('last_message_timestamp', { ascending: false });

            if (error) throw error;

            // Format chats for frontend
            const formattedChats = data.map(chat => ({
                peerId: chat.peer_id,
                peerPhone: chat.peer?.name || chat.peer?.phone || 'Unknown',
                lastMessage: {
                    msg: chat.last_message_content,
                    ts: chat.last_message_timestamp
                },
                unreadCount: chat.unread_count,
                isOnline: chat.peer?.is_online || false
            }));

            return { status: 'success', chats: formattedChats };

        } catch (error) {
            console.error('Get chats error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Update chat settings
     */
    async updateChatSettings(peerId, settings) {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            // First get or create the chat record
            let { data: chatData } = await this.supabase
                .from('user_chats')
                .select('id')
                .eq('owner_id', this.currentUser.id)
                .eq('peer_id', peerId)
                .single();

            if (!chatData) {
                // Create chat record if it doesn't exist
                const { data: newChat, error: chatError } = await this.supabase
                    .from('user_chats')
                    .insert({
                        owner_id: this.currentUser.id,
                        peer_id: peerId
                    })
                    .select('id')
                    .single();

                if (chatError) throw chatError;
                chatData = newChat;
            }

            // Update or insert settings
            const { data, error } = await this.supabase
                .from('chat_settings')
                .upsert({
                    owner_id: this.currentUser.id,
                    chat_id: chatData.id,
                    settings: settings
                })
                .select()
                .single();

            if (error) throw error;

            return { status: 'success', settings: data };

        } catch (error) {
            console.error('Update chat settings error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Archive a chat
     */
    async archiveChat(peerId) {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            const { error } = await this.supabase
                .from('user_chats')
                .update({ is_archived: true })
                .eq('owner_id', this.currentUser.id)
                .eq('peer_id', peerId);

            if (error) throw error;

            return { status: 'success' };

        } catch (error) {
            console.error('Archive chat error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Delete a chat
     */
    async deleteChat(peerId) {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            // Delete all messages in the chat
            await this.supabase
                .from('messages')
                .delete()
                .or(`from_user_id.eq.${this.currentUser.id},to_user_id.eq.${this.currentUser.id}`)
                .eq('from_user_id', peerId);

            // Delete chat record
            await this.supabase
                .from('user_chats')
                .delete()
                .eq('owner_id', this.currentUser.id)
                .eq('peer_id', peerId);

            return { status: 'success' };

        } catch (error) {
            console.error('Delete chat error:', error);
            return { status: 'error', message: error.message };
        }
    }

    // =====================================================
    // REALTIME METHODS
    // =====================================================

    /**
     * Subscribe to real-time message updates
     */
    subscribeToMessages(peerId, callback) {
        if (!this.isInitialized || !this.currentUser) return null;

        const channelName = `messages:${this.currentUser.id}:${peerId}`;

        // Remove existing channel if it exists
        if (this.realtimeChannels.has(channelName)) {
            this.unsubscribeFromChannel(channelName);
        }

        console.log('🔄 Setting up real-time subscription for chat:', {
            currentUserId: this.currentUser.id,
            peerId: peerId,
            channelName: channelName
        });

        const channel = this.supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages'
                },
                (payload) => {
                    console.log('📨 Real-time message received:', payload);

                    // Check if message is relevant to this conversation (bidirectional)
                    const isFromCurrentUserToPeer = payload.new.from_user_id === this.currentUser.id && payload.new.to_user_id === peerId;
                    const isFromPeerToCurrentUser = payload.new.from_user_id === peerId && payload.new.to_user_id === this.currentUser.id;

                    console.log('📨 Message relevance check:', {
                        messageFrom: payload.new.from_user_id,
                        messageTo: payload.new.to_user_id,
                        currentUserId: this.currentUser.id,
                        peerId: peerId,
                        isFromCurrentUserToPeer: isFromCurrentUserToPeer,
                        isFromPeerToCurrentUser: isFromPeerToCurrentUser,
                        isRelevant: isFromCurrentUserToPeer || isFromPeerToCurrentUser
                    });

                    if (isFromCurrentUserToPeer || isFromPeerToCurrentUser) {
                        console.log('✅ Processing relevant message for this conversation');
                        callback(payload.new);
                    } else {
                        console.log('❌ Ignoring irrelevant message for this conversation');
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages'
                },
                (payload) => {
                    // Check if updated message is relevant to this conversation
                    const isFromCurrentUserToPeer = payload.new.from_user_id === this.currentUser.id && payload.new.to_user_id === peerId;
                    const isFromPeerToCurrentUser = payload.new.from_user_id === peerId && payload.new.to_user_id === this.currentUser.id;

                    if (isFromCurrentUserToPeer || isFromPeerToCurrentUser) {
                        console.log('📨 Real-time message update:', payload);
                        callback(payload.new);
                    }
                }
            )
            .subscribe((status) => {
                console.log('📡 Real-time subscription status for', channelName, ':', status);
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Successfully subscribed to real-time messages');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Real-time subscription error');
                } else if (status === 'TIMED_OUT') {
                    console.error('❌ Real-time subscription timed out');
                } else if (status === 'CLOSED') {
                    console.log('📡 Real-time subscription closed');
                }
            });

        this.realtimeChannels.set(channelName, channel);
        return channel;
    }

    /**
     * Subscribe to user status updates
     */
    subscribeToUserStatus(callback) {
        if (!this.isInitialized || !this.currentUser) return null;

        const channelName = 'user_status';

        if (this.realtimeChannels.has(channelName)) {
            this.unsubscribeFromChannel(channelName);
        }

        const channel = this.supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'users'
                },
                (payload) => {
                    callback(payload.new);
                }
            )
            .subscribe();

        this.realtimeChannels.set(channelName, channel);
        return channel;
    }

    /**
     * Update typing status
     */
    async updateTypingStatus(peerId, isTyping) {
        await this.ensureInitialized();

        if (!this.currentUser) return;

        try {
            // In a real implementation, you'd have a typing_status table
            // For now, we'll use a simple approach with cache-like behavior
            console.log(`Typing status: ${isTyping ? 'started' : 'stopped'} for user ${peerId}`);
        } catch (error) {
            console.error('Update typing status error:', error);
        }
    }

    /**
     * Unsubscribe from a specific channel
     */
    unsubscribeFromChannel(channelName) {
        const channel = this.realtimeChannels.get(channelName);
        if (channel) {
            this.supabase.removeChannel(channel);
            this.realtimeChannels.delete(channelName);
        }
    }

    /**
     * Close all realtime channels
     */
    closeAllRealtimeChannels() {
        this.realtimeChannels.forEach((channel, name) => {
            this.supabase.removeChannel(channel);
        });
        this.realtimeChannels.clear();
    }

    // =====================================================
    // FILE UPLOAD METHODS
    // =====================================================

    /**
     * Upload profile picture
     */
    async uploadProfilePicture(file) {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${this.currentUser.id}-${Date.now()}.${fileExt}`;

            const { data, error } = await this.supabase.storage
                .from('profile-pictures')
                .upload(fileName, file);

            if (error) throw error;

            // Get public URL
            const { data: urlData } = this.supabase.storage
                .from('profile-pictures')
                .getPublicUrl(fileName);

            // Update user profile
            await this.updateProfile({
                profile_picture_url: urlData.publicUrl
            });

            return { status: 'success', url: urlData.publicUrl };

        } catch (error) {
            console.error('Upload profile picture error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Upload chat file
     */
    async uploadChatFile(file, peerId) {
        await this.ensureInitialized();

        if (!this.currentUser) {
            return { status: 'error', message: 'No authenticated user' };
        }

        try {
            // Validate file
            if (!file || file.size === 0) {
                throw new Error('Invalid file');
            }

            // Check file size (limit to 10MB)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                throw new Error('File size must be less than 10MB');
            }

            // Validate file type
            const allowedTypes = [
                'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                'application/pdf', 'text/plain',
                'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/zip', 'application/x-rar-compressed'
            ];

            if (!allowedTypes.includes(file.type) && !file.type.startsWith('image/')) {
                throw new Error('File type not allowed');
            }

            const fileExt = file.name.split('.').pop().toLowerCase();
            const timestamp = Date.now();
            const randomId = Math.random().toString(36).substring(2, 15);
            const fileName = `${this.currentUser.id}-${peerId}-${timestamp}-${randomId}.${fileExt}`;

            console.log('📁 Uploading file:', fileName, 'Size:', file.size, 'Type:', file.type);

            const { data, error } = await this.supabase.storage
                .from('chat-files')
                .upload(fileName, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('Storage upload error:', error);
                throw error;
            }

            // Get public URL
            const { data: urlData } = this.supabase.storage
                .from('chat-files')
                .getPublicUrl(fileName);

            console.log('✅ File uploaded successfully:', urlData.publicUrl);

            return {
                status: 'success',
                url: urlData.publicUrl,
                name: file.name,
                size: file.size,
                type: file.type
            };

        } catch (error) {
            console.error('Upload chat file error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Delete file from storage
     */
    async deleteFile(bucket, fileName) {
        await this.ensureInitialized();

        try {
            const { error } = await this.supabase.storage
                .from(bucket)
                .remove([fileName]);

            if (error) throw error;

            return { status: 'success' };

        } catch (error) {
            console.error('Delete file error:', error);
            return { status: 'error', message: error.message };
        }
    }

    // =====================================================
    // EMAIL METHODS
    // =====================================================

    /**
     * Send OTP email for authentication
     */
    async sendOTP(to, otp, name = null) {
        await this.ensureInitialized();

        try {
            const { data, error } = await this.supabase.functions.invoke('send-otp', {
                body: { to, otp, name }
            });

            if (error) throw error;

            return { status: 'success', message: 'OTP email sent successfully' };

        } catch (error) {
            console.error('Send OTP error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Send general email using send-otp function
     */
    async sendEmail(to, subject, htmlContent, name = null) {
        await this.ensureInitialized();

        try {
            // Create a simple HTML email template
            const emailBody = `
                <!DOCTYPE html>
                <html>
                  <head>
                    <meta charset="utf-8">
                    <title>${subject}</title>
                    <style>
                      body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                      .header { background: linear-gradient(135deg, #0084ff, #44c8f5); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
                      .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; }
                      .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h1>📧 Digidad Message</h1>
                      </div>
                      <div class="content">
                        <h2>${subject}</h2>
                        ${htmlContent}
                        <p><strong>Sent by Digidad Messaging App</strong></p>
                      </div>
                      <div class="footer">
                        <p>This email was sent from Digidad Messaging App</p>
                      </div>
                    </div>
                  </body>
                </html>
            `;

            const { data, error } = await this.supabase.functions.invoke('send-otp', {
                body: {
                    to,
                    otp: 'EMAIL', // Using a dummy OTP since it's required
                    name,
                    customSubject: subject,
                    customHtml: emailBody
                }
            });

            if (error) throw error;

            return { status: 'success', message: 'Email sent successfully' };

        } catch (error) {
            console.error('Send email error:', error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Send welcome email to new users
     */
    async sendWelcomeEmail(userEmail, userName) {
        await this.ensureInitialized();

        const emailHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>Welcome to Digidad</title>
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background: linear-gradient(135deg, #0084ff, #44c8f5); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                  .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                  .button { background: #0084ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
                  .footer { text-align: center; margin-top: 20px; color: #666; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>🎉 Welcome to Digidad!</h1>
                    <p>Your secure messaging journey begins now</p>
                  </div>
                  <div class="content">
                    <h2>Hello ${userName || 'User'}!</h2>
                    <p>Welcome to <strong>Digidad Messaging App</strong>! We're excited to have you join our community.</p>
                    <p>With Digidad, you can:</p>
                    <ul>
                      <li>💬 Send secure messages to your contacts</li>
                      <li>🔒 Keep your conversations private and encrypted</li>
                      <li>📱 Access your messages from any device</li>
                      <li>👥 Manage your contacts easily</li>
                    </ul>
                    <a href="#" class="button">Start Messaging</a>
                    <p>If you have any questions, our support team is here to help!</p>
                  </div>
                  <div class="footer">
                    <p>This email was sent by Digidad Messaging App</p>
                    <p>You're receiving this because you recently created an account.</p>
                  </div>
                </div>
              </body>
            </html>
        `;

        return await this.sendEmail(userEmail, 'Welcome to Digidad!', emailHtml, userName);
    }

    // =====================================================
    // UTILITY METHODS
    // =====================================================

    /**
     * Set current user (for React context synchronization)
     */
    setCurrentUser(user) {
        this.currentUser = user;
        console.log('✅ Supabase client currentUser set:', user?.id);
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Check if user is authenticated
     */
    isAuthenticated() {
        return this.currentUser !== null;
    }

    /**
      * Generate chat ID for two users
      */
    generateChatId(userId1, userId2) {
        return [userId1, userId2].sort().join('_');
    }

    /**
      * Test database connection
      */
    async testConnection() {
        await this.ensureInitialized();

        try {
            console.log('🧪 Testing database connection...');

            // Try with Supabase client first
            const { data, error } = await this.supabase.from('users').select('count').limit(1);

            if (error) {
                console.error('❌ Supabase client test failed:', error);

                // Try with direct fetch as fallback
                console.log('🔄 Trying direct fetch test...');
                const response = await fetch(
                    `${SUPABASE_CONFIG.SUPABASE_URL}/rest/v1/users?select=count&limit=1`,
                    {
                        method: 'GET',
                        headers: {
                            'apikey': SUPABASE_CONFIG.SUPABASE_ANON_KEY,
                            'Authorization': `Bearer ${SUPABASE_CONFIG.SUPABASE_ANON_KEY}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                if (response.ok) {
                    console.log('✅ Direct fetch test successful');
                    return { status: 'success', method: 'direct_fetch' };
                } else {
                    console.error('❌ Direct fetch test failed:', response.status, response.statusText);
                    return { status: 'error', error: { status: response.status, message: response.statusText } };
                }
            } else {
                console.log('✅ Supabase client test successful');
                return { status: 'success', data, method: 'supabase_client' };
            }
        } catch (error) {
            console.error('❌ Connection test error:', error);
            return { status: 'error', error };
        }
    }
}

// Create global instance using singleton pattern
const supabaseClient = SupabaseClient.getInstance();

// Export for use in other files
window.supabaseClient = supabaseClient;

// Make test functions available globally for debugging
window.testSupabaseConnection = () => supabaseClient.testConnection();
window.testDirectFetch = async () => {
    console.log('🧪 Testing direct fetch...');
    try {
        const response = await fetch(
            `${SUPABASE_CONFIG.SUPABASE_URL}/rest/v1/users?select=id,phone,name&phone=eq.1234567890`,
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_CONFIG.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_CONFIG.SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));
        const data = await response.text();
        console.log('Response data:', data);
        return { status: response.status, data };
    } catch (error) {
        console.error('Direct fetch error:', error);
        return { error };
    }
};

// Test search functionality
window.testSearch = async (phoneNumber) => {
    console.log('🧪 Testing search with:', phoneNumber);
    return await supabaseClient.findUserByPhone(phoneNumber);
};

// Show all users in database
window.showAllUsers = async () => {
    console.log('🧪 Fetching all users...');
    try {
        const { data, error } = await supabaseClient.supabase
            .from('users')
            .select('id, phone, name')
            .limit(10);

        if (error) {
            console.error('❌ Error fetching users:', error);
            return { error };
        }

        console.log('✅ Users in database:', data);
        return { users: data };
    } catch (error) {
        console.error('❌ Fetch error:', error);
        return { error };
    }
};

// Test search UI
window.testSearchUI = () => {
    console.log('🧪 Testing search UI...');
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.value = '1234567890';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        console.log('✅ Test input dispatched');
    } else {
        console.error('❌ Search input not found');
    }
};