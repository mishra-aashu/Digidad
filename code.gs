// =================================================================================
// CONFIGURATION & CONSTANTS
// =================================================================================
const SPREADSHEET_ID = "1_XJ_eF-fpaqDgSEntReFqHBxIudJ4JU168usQ6MDhw4"; // This ID is correct.
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

const usersSheet = getOrCreateSheet("Users", ['ID', 'Phone', 'Name']);
const messagesSheet = getOrCreateSheet("Messages", ['Timestamp', 'MessageID', 'FromID', 'ToID', 'Content', 'IsSeen', 'ReplyToID', 'Status']); // New, better model

const userChatsSheet = getOrCreateSheet("UserChats", ['ownerId', 'peerId', 'lastMessage', 'timestamp', 'unreadCount']); // For chat list
const contactsSheet = getOrCreateSheet("Contacts", ['Timestamp', 'OwnerID', 'ContactName', 'ContactPhone']);
const aliasSheet = getOrCreateSheet("ContactAliases", ['OwnerID', 'PeerID', 'CustomName']);
const settingsSheet = getOrCreateSheet("ChatSettings", ['ownerId', 'chatId', 'settingsJson']);

const cache = CacheService.getScriptCache();

// =================================================================================
// HELPER FUNCTIONS
// =================================================================================
/**
 * Gets a sheet by name, or creates it with headers if it doesn't exist.
 * @param {string} sheetName The name of the sheet to get or create.
 * @param {Array<string>} headers An array of header strings for the first row.
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} The sheet object.
 */
function getOrCreateSheet(sheetName, headers = []) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers.length > 0) {
      sheet.appendRow(headers);
    }
  }
  return sheet;
}
/**
 * Gets the unique chat ID for two users by sorting their IDs.
 */
function getChatId(userA, userB) {
  return [userA, userB].sort().join('_');
}

/**
 * Main entry point for the web app. Handles all GET requests.
 * @param {object} e The event parameter from the web app request.
 * @returns {GoogleAppsScript.Content.TextOutput} A JSONP response.
 */
function doGet(e) {
  const params = e.parameter;
  const action = params.action;
  let result = {};

  const lock = LockService.getScriptLock();
  const hasLock = lock.tryLock(20000); // Wait up to 20 seconds

  if (!hasLock) { return createJsonResponse({ status: 'error', message: 'Server is busy, please try again.' }, params.callback); }

  try {
    switch (action) {
      case 'login':
        result = loginUser(params.phone);
        break;
      case 'sendMessage':
        result = sendMessage(params); // Use the better sendMessage function
        break;
      case 'getMessages':
        result = getMessages(params.userId, params.peerId, params.beforeTs, params.afterTs, params.limit);
        break;
      case 'heartbeat':
        result = updateUserHeartbeat(params.userId);
        break;
      case 'findUser':
        result = findUserByPhone(params.phone);
        break;
      case 'setUserName':
        result = setUserName(params.userId, params.name);
        break;
      case 'editPeerName':
        result = editPeerName(params.ownerId, params.peerId, params.newName);
        break;
      case 'addContact':
        result = addContact(params.ownerId, params.contactName, params.contactPhone);
        break;
      case 'setChatSetting':
        result = setChatSetting(params.ownerId, params.peerId, params.settingKey, params.settingValue);
        break;
      case 'deleteChat':
        result = deleteChat(params.ownerId, params.peerId);
        break;
      case 'setTypingStatus':
        result = setTypingStatus(params.fromId, params.toId);
        break;
      case 'deleteMessage':
        result = deleteMessage(params.messageId, params.userId);
        break;
      case 'editMessage':
        result = editMessage(params.messageId, params.newMsg, params.userId);
        break;
      default:
        result = { status: 'error', message: 'Invalid action' };
    }
  } catch (error) {
    result = { status: 'error', message: 'Server error: ' + error.toString(), stack: error.stack };
  } finally {
    lock.releaseLock();
  }

  return createJsonResponse(result, params.callback);
}

/**
 * Creates a JSONP response.
 * @param {object} data The data to be returned.
 * @param {string} jsonpCallback The name of the callback function.
 * @returns {GoogleAppsScript.Content.TextOutput} A JSONP response.
 */
function createJsonResponse(data, jsonpCallback) {
  const json = JSON.stringify(data);
  if (jsonpCallback) {
    return ContentService.createTextOutput(`${jsonpCallback}(${json})`).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

/**
 * This function will handle all POST requests, including our new file uploads.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    if (data.action === 'uploadFile') {
      return handleFileUpload(data);
    }

    // You can add other POST actions here in the future
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Invalid POST action' })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * This helper function handles the file upload logic.
 */
function handleFileUpload(data) {
  var fromId = data.fromId, toId = data.toId, fileName = data.fileName, fileType = data.fileType, base64Data = data.fileData;
  var decoded = Utilities.base64Decode(base64Data, Utilities.Charset.UTF_8);
  var blob = Utilities.newBlob(decoded, fileType, fileName);
  var folderId = "14VJc9RaoI0TCCHjWXz_5Uc7Gs9-ioGdh"; // Your Google Drive Folder ID is now here.
  var folder = DriveApp.getFolderById(folderId);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fileUrl = "https://drive.google.com/uc?export=view&id=" + file.getId();
  sendMessage({ fromId: fromId, toId: toId, msg: fileUrl, tempId: `file_${Date.now()}`, replyTo: fileName });
  return ContentService.createTextOutput(JSON.stringify({ status: 'success', fileUrl: fileUrl })).setMimeType(ContentService.MimeType.JSON);
}
// =================================================================================
// CORE API FUNCTIONS
// =================================================================================
/**
 * Logs in a user or creates a new one.
 * @param {string} phone The user's phone number.
 * @returns {object} The user's session data.
 */
function loginUser(phone) {
  const usersData = usersSheet.getDataRange().getValues();
  let userId = null;
  let userName = null;
  let userExists = false;

  // Check if user exists
  for (let i = 1; i < usersData.length; i++) {
    if (usersData[i][1] == phone) {
      userId = usersData[i][0];
      userExists = true;
      userName = usersData[i][2] || null; // Get user's name
      break;
    }
  }

  // If not, create new user
  if (!userExists) {
    userId = usersData.length; // Simple incremental ID as per old logic
    usersSheet.appendRow([userId, phone, '']);
    userName = null;
  }

  // Get all chat relationships for the user from the UserChats sheet.
  const userChatsData = userChatsSheet.getDataRange().getValues();
  const userChatEntries = [];
  for (let i = 1; i < userChatsData.length; i++) {
    if (userChatsData[i][0] == userId) { // ownerId matches
      userChatEntries.push({
        peerId: userChatsData[i][1],
        lastMessage: { msg: userChatsData[i][2], ts: userChatsData[i][3] },
        unreadCount: parseInt(userChatsData[i][4] || '0', 10)
      });
    }
  }
  // Get custom contact names for the logged-in user
  const customNames = getCustomNamesForUser(userId);

  // Get chat-specific settings for the user
  const settingsData = settingsSheet.getDataRange().getValues();
  const chatSettings = {};
  for (let i = 1; i < settingsData.length; i++) {
    if (settingsData[i][0] == userId) {
      chatSettings[settingsData[i][1]] = JSON.parse(settingsData[i][2] || '{}');
    }
  }

  const chats = [];
  for (const chatEntry of userChatEntries) {
    const peerId = chatEntry.peerId.toString();
    const peerInfo = usersData.find(row => row[0] == peerId);
    if (peerInfo) {
      const peerPhone = peerInfo[1];
      const chatId = getChatId(userId, peerId);
      const isOnline = cache.get(`online_${peerId}`) === 'true';
      chats.push({
        peerId: peerId,
        peerPhone: customNames[peerId] || peerPhone, // Use custom name if it exists
        lastMessage: chatEntry.lastMessage,
        isOnline: isOnline,
        unreadCount: chatEntry.unreadCount,
        settings: chatSettings[chatId] || {} // Attach settings to the chat object
      });
    }
  }

  // Sort chats by the timestamp of the last message in descending order
  chats.sort((a, b) => new Date(b.lastMessage.ts || 0) - new Date(a.lastMessage.ts || 0));

  // Get user's saved contacts
  const userContacts = getContactsForUser(userId);

  return {
    status: userExists ? "exists" : "new",
    userId: userId,
    name: userName,
    chats: chats,
    contacts: userContacts
  };
}

function sendMessage(params) {
    const fromId = params.fromId;
    const toId = params.toId;
    const msg = params.msg;
    const tempId = params.tempId;
    const replyTo = params.replyTo;
    const ts = new Date();
    const messageId = Utilities.getUuid();

    messagesSheet.appendRow([
      ts,
      messageId,
      fromId,
      toId,
      msg,
      false, // isSeen
      replyTo || ""
    ]);

    updateLastMessage(fromId, toId, fromId, toId, msg, ts.toISOString());
    updateLastMessage(toId, fromId, fromId, toId, msg, ts.toISOString());

    return {
      status: 'sent',
      messageId: messageId,
      tempId: tempId
    };
}
/**
 * Gets messages from the Messages sheet.
 */
function getMessages(userId, peerId, beforeTs, afterTs, limit) {
  limit = parseInt(limit || '50', 10);
  const messagesData = messagesSheet.getDataRange().getValues();
  const customNames = getCustomNamesForUser(userId);
  
  let allChatMessages = [];
  let messagesToUpdate = [];

  // 1. Filter messages for the current chat and handle 'seen' status
  for (let i = 1; i < messagesData.length; i++) {
    const row = messagesData[i];
    const fromId = row[2];
    const toId = row[3];

    if ((fromId == userId && toId == peerId) || (fromId == peerId && toId == userId)) {
      allChatMessages.push({
        id: row[1],
        from: fromId,
        msg: row[4],
        ts: new Date(row[0]).toISOString(),
        seen: row[5],
        replyTo: row[6]
      });
      // Mark as seen
      if (fromId == peerId && row[5] !== true) {
        messagesToUpdate.push(i + 1); // +1 for 1-based index
      }
    }
  }

  // 2. Update 'seen' status in the sheet
  if (messagesToUpdate.length > 0) {
    messagesToUpdate.forEach(rowIndex => {
      messagesSheet.getRange(rowIndex, 6).setValue(true);
    });
    resetUnreadCount(userId, peerId);
  }

  // 3. Pagination
  let paginatedMessages = allChatMessages;
  if (afterTs) {
    paginatedMessages = allChatMessages.filter(m => new Date(m.ts) > new Date(afterTs));
  } else if (beforeTs) {
    allChatMessages.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    paginatedMessages = allChatMessages.filter(m => new Date(m.ts) < new Date(beforeTs));
    paginatedMessages = paginatedMessages.slice(0, limit).reverse();
  } else {
    paginatedMessages = allChatMessages.slice(-limit);
  }

  // 4. Resolve replies
  const messageMap = new Map(allChatMessages.map(m => [m.id.toString(), m]));
  paginatedMessages.forEach(message => {
    if (message.replyTo && messageMap.has(message.replyTo.toString())) {
      const originalMessage = messageMap.get(message.replyTo.toString());
      const authorId = originalMessage.from;
      let authorName = "User";
      if (authorId == userId) {
        authorName = "You";
      } else if (customNames[authorId]) {
        authorName = customNames[authorId];
      }
      message.replyTo = { id: originalMessage.id, text: originalMessage.msg, author: authorName };
    }
  });

  // 5. Get peer's status
  const isOnline = cache.get(`online_${peerId}`) === 'true';
  const isTyping = cache.get(`typing_${peerId}_to_${userId}`) === 'true';

  return {
    status: 'ok',
    messages: paginatedMessages,
    isOnline: isOnline,
    isTyping: isTyping,
    hasMore: allChatMessages.length > limit && !afterTs
  };
}
function findUserByPhone(phone) {
  const data = usersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == phone) {
      return { status: "found", userId: data[i][0], phone: phone };
    }
  }
  return { status: "not_found" };
}
function setUserName(userId, name) {
  const usersData = usersSheet.getDataRange().getValues();
  for (let i = 1; i < usersData.length; i++) {
    if (usersData[i][0] == userId) {
      usersSheet.getRange(i + 1, 3).setValue(name); // Column 3 is 'Name'
      return { status: "success" };
    }
  }
  return { status: "error", msg: "User not found" };
}
function editPeerName(ownerId, peerId, newName) {
    const data = aliasSheet.getDataRange().getValues();
    let recordFound = false;

    // Find if a record already exists
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == ownerId && data[i][1] == peerId) {
        aliasSheet.getRange(i + 1, 3).setValue(newName); // Update existing name
        recordFound = true;
        break;
      }
    }
    // If no record found, create a new one
    if (!recordFound) {
      aliasSheet.appendRow([ownerId, peerId, newName]);
    }
    return { status: "success", newName: newName };
}
function addContact(ownerId, contactName, contactPhone) {
  if (!ownerId || !contactName || !contactPhone) {
    return { status: "error", message: "Missing parameters." };
  }
  contactsSheet.appendRow([new Date(), ownerId, contactName, contactPhone]);
  const updatedContacts = getContactsForUser(ownerId);
  return { status: "success", contacts: updatedContacts };
}
function setChatSetting(ownerId, peerId, key, value) {
  const chatId = getChatId(ownerId, peerId);
  const data = settingsSheet.getDataRange().getValues();
  let foundRow = -1;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] == ownerId && data[i][1] == chatId) {
      foundRow = i + 1;
      break;
    }
  }

  if (foundRow !== -1) {
    const existingSettings = JSON.parse(data[foundRow - 1][2] || '{}');
    existingSettings[key] = value;
    settingsSheet.getRange(foundRow, 3).setValue(JSON.stringify(existingSettings));
  } else {
    const newSettings = {};
    newSettings[key] = value;
    settingsSheet.appendRow([ownerId, chatId, JSON.stringify(newSettings)]);
  }
  return { status: "success" };
}
function deleteChat(ownerId, peerId) {
  const messagesData = messagesSheet.getDataRange().getValues();
  const rowsToDelete = [];

  for (let i = messagesData.length - 1; i >= 1; i--) {
    const row = messagesData[i];
    const fromId = row[2];
    const toId = row[3];

    if ((fromId == ownerId && toId == peerId) || (fromId == peerId && toId == ownerId)) {
      rowsToDelete.push(i + 1);
    }
  }

  // delete rows from bottom to top to avoid shifting issues
  for (const rowIndex of rowsToDelete) {
    messagesSheet.deleteRow(rowIndex);
  }

  // Delete from 'UserChats' sheet for both users
  deleteUserChatEntry(ownerId, peerId);
  deleteUserChatEntry(peerId, ownerId);

  return { status: "success", message: "Chat deleted." };
}
function updateUserHeartbeat(userId) {
  if (!userId) return { status: 'error', message: 'No user ID' };
  cache.put(`online_${userId}`, 'true', 20); // User is online for 20 seconds
  return { status: 'ok' };
}
function setTypingStatus(fromId, toId) {
  if (!fromId || !toId) return { status: 'error', message: 'Missing IDs' };
  cache.put(`typing_${fromId}_to_${toId}`, 'true', 10); // Expires in 10 seconds
  return { status: 'ok' };
}

/**
 * "Deletes" a message by replacing its content.
 * @param {string} messageId The ID of the message to delete.
 * @param {string} userId The ID of the user requesting the deletion.
 */
function deleteMessage(messageId, userId) {
  const messagesData = messagesSheet.getDataRange().getValues();
  for (let i = 1; i < messagesData.length; i++) {
    if (messagesData[i][1] === messageId) {
      if (messagesData[i][2] != userId) {
        return { status: 'error', message: 'Permission denied.' };
      }
      messagesSheet.getRange(i + 1, 5).setValue("[This message was deleted]");
      return { status: 'deleted' };
    }
  }
  return { status: 'error', message: 'Message not found.' };
}

/**
 * Edits the content of an existing message.
 * @param {string} messageId The ID of the message to edit.
 * @param {string} newMsg The new message content.
 * @param {string} userId The ID of the user requesting the edit.
 */
function editMessage(messageId, newMsg, userId) {
  const messagesData = messagesSheet.getDataRange().getValues();
  for (let i = 1; i < messagesData.length; i++) {
    if (messagesData[i][1] === messageId) {
      if (messagesData[i][2] != userId) {
        return { status: 'error', message: 'Permission denied.' };
      }
      messagesSheet.getRange(i + 1, 5).setValue(newMsg + " (edited)");
      return { status: 'edited' };
    }
  }
  return { status: 'error', message: 'Message not found.' };
}
// =================================================================================
// DATA & UTILITY FUNCTIONS
// =================================================================================
function getContactsForUser(userId) {
  if (!contactsSheet) return [];
  const data = contactsSheet.getDataRange().getValues();
  const userContacts = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == userId) {
      userContacts.push({ name: data[i][2], phone: data[i][3] });
    }
  }
  return userContacts;
}
function getCustomNamesForUser(userId) {
    const aliasData = aliasSheet.getDataRange().getValues();
    const customNames = {};
    for (let i = 1; i < aliasData.length; i++) {
        if (aliasData[i][0] == userId) { // ownerId matches
            customNames[aliasData[i][1]] = aliasData[i][2]; // peerId -> customName
        }
    }
    return customNames;
}
function updateLastMessage(ownerId, peerId, fromId, toId, msg, ts) {
    const cacheKey = `userchat_${ownerId}_${peerId}`;
    let rowData = cache.get(cacheKey);
    let rowIndex;

    if (rowData) {
        rowIndex = JSON.parse(rowData).rowIndex;
    } else {
        const data = userChatsSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] == ownerId && data[i][1] == peerId) {
                rowIndex = i + 1;
                cache.put(cacheKey, JSON.stringify({ rowIndex: rowIndex }), 3600); // Cache for 1 hour
                break;
            }
        }
    }

    if (rowIndex) {
        // Update last message and timestamp
        userChatsSheet.getRange(rowIndex, 3, 1, 2).setValues([[msg, ts]]);
        // If this entry belongs to the recipient, increment their unread count
        if (ownerId == toId) {
            const unreadCountCell = userChatsSheet.getRange(rowIndex, 5);
            const currentCount = parseInt(unreadCountCell.getValue() || '0', 10);
            unreadCountCell.setValue(currentCount + 1);
        }
    } else {
        // If no row found, create a new one
        const unreadCount = (ownerId == toId) ? 1 : 0;
        const newRow = userChatsSheet.appendRow([ownerId, peerId, msg, ts, unreadCount]);
        // CRITICAL FIX: After appending a new row, we must invalidate the old (non-existent) cache entry
        // AND immediately cache the new row's index. This prevents a re-scan on the very next message.
        const newRowIndex = newRow.getLastRow();
        cache.put(cacheKey, JSON.stringify({ rowIndex: newRowIndex }), 3600);
    }
}
function resetUnreadCount(ownerId, peerId) {
    const cacheKey = `userchat_${ownerId}_${peerId}`;
    let rowIndex = JSON.parse(cache.get(cacheKey))?.rowIndex;

    if (!rowIndex) {
        const data = userChatsSheet.getDataRange().getValues();
        for (let i = 1; i < data.length; i++) {
            if (data[i][0] == ownerId && data[i][1] == peerId) {
                rowIndex = i + 1;
                // We can also cache it here for future use
                cache.put(cacheKey, JSON.stringify({ rowIndex: rowIndex }), 3600);
                break;
            }
        }
    }

    if (rowIndex) {
        userChatsSheet.getRange(rowIndex, 5).setValue(0); // Column 5 is unreadCount
    }
}
function deleteUserChatEntry(ownerId, peerId) {
  const data = userChatsSheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] == ownerId && data[i][1] == peerId) {
      userChatsSheet.deleteRow(i + 1);
    }
  }
}