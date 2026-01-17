# Guardian Decryption UX - Quick Guide

## For Guardians: How to Use

### 1️⃣ **Initial Submission**

1. Navigate to your election page
2. Go to the **"Guardian Keys"** tab
3. Upload your `credentials.txt` file (from email)
4. Click **"Submit Guardian Credentials"**
5. ✅ **Immediate validation** happens (1-2 seconds)
   - ✓ Valid: Modal opens automatically showing progress
   - ✗ Invalid: Error message shown immediately

### 2️⃣ **If You Reload the Page**

Don't worry! Your progress is saved:
- A colored banner appears at the top
- Click **"Check Progress"** to see current status
- Modal shows real-time updates

### 3️⃣ **If Credentials Were Wrong**

You'll see:
- 🚫 **Red error banner** with clear message
- **List of steps** to fix the issue
- **"View Error & Retry"** button
- Submit button changes to **"🔄 Retry with Correct Credentials"**

**To retry:**
1. Close the error modal
2. Upload the correct credentials.txt file
3. Click the retry button
4. Process starts fresh

### 4️⃣ **While Processing**

- Modal shows live progress updates
- You can close it - processing continues in background
- Reload the page anytime - progress is preserved
- "Check Progress" button always available

### 5️⃣ **When Complete**

- 🎉 **Green success banner** appears
- Modal shows completion metrics:
  - Chunks processed
  - Backup shares generated
- Submit button shows **"✅ Decryption Completed"**
- Cannot submit again (already done!)

## Visual Status Guide

### 🔴 **Red Banner - Failed**
- **Means:** Your credentials were incorrect
- **Action:** Upload correct file and retry
- **Button:** "View Error & Retry"

### 🟢 **Green Banner - Success**
- **Means:** Everything completed successfully
- **Action:** None needed, you're done!
- **Button:** "View Details"

### 🔵 **Blue Banner - Processing**
- **Means:** Your decryption is in progress
- **Action:** Wait or check progress
- **Button:** "Check Progress"

## Common Questions

**Q: What if I lost my credentials.txt file?**
A: Contact the election administrator to get a new copy.

**Q: Can I submit multiple times?**
A: Only if the previous submission failed. Completed submissions cannot be resubmitted.

**Q: How long does it take?**
A: Typically 30 seconds to 2 minutes, depending on election size.

**Q: What if I close the browser?**
A: No problem! Processing continues on the server. Just come back and click "Check Progress".

**Q: The modal says "invalid credentials" - what now?**
A: Make sure you're using the credentials.txt file that was emailed to you specifically for this election. If you can't find it, contact the administrator.

## Troubleshooting

### "File upload doesn't work"
- Ensure file is named `credentials.txt`
- Check file isn't corrupted
- Try a different browser

### "Button is disabled"
- Wait for current process to complete
- If stuck, reload page and check status

### "Modal shows old progress"
- Click refresh or reload the page
- Modal polls every 2 seconds automatically

### "Nothing happens after submit"
- Check browser console for errors
- Verify internet connection
- Try submitting again

## Administrator Notes

### Monitoring Guardian Progress
- Each guardian's status is tracked individually
- Admins can see who has submitted
- Failed submissions are logged with reasons
- Retry attempts are allowed for failed submissions

### Database Tables Used
- `decryption_status` - Tracks progress
- `decryption` - Stores successful results
- `compensated_decryption` - Backup shares

## Need Help?

If you encounter issues:
1. Take a screenshot of any error messages
2. Note what you were trying to do
3. Contact the election administrator
4. Provide your guardian ID/email

---

**Remember:** This process is secure and your credentials never leave the system unencrypted. The progress tracking is just for your convenience - your actual decryption work happens safely on the server.
