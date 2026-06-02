# Privacy Policy for ArchiView

**Effective Date:** June 3, 2026

## 1. Introduction
Welcome to ArchiView. This Privacy Policy explains how ArchiView ("the Application", "we", or "us") collects, uses, and handles your information when you use our desktop software and its associated cloud synchronization features. ArchiView is an open-source, offline-first application designed for cataloging, archiving, and transcribing manuscripts and historical documents.

## 2. Google User Data and Google Drive Integration
ArchiView offers an optional Cloud Synchronization feature that allows users to back up and sync their database and attachments to their personal Google Drive.

To provide this functionality, ArchiView requests access to your Google account using the following scope:
- `https://www.googleapis.com/auth/drive.file`

### How we use this data:
- **Restricted Access:** ArchiView only requests access to the specific files and folders that it creates within your Google Drive. It **cannot** read, modify, or delete any other files or folders in your Google Drive that were not created by ArchiView.
- **Functionality:** The data is used exclusively to sync your ArchiView databases (`database_manoscritti.json`), configuration files, and attachments (images, PDFs) between your local device and your personal Google Drive, allowing you to access your workspace across multiple devices or share it with collaborators.

### Data Storage and Sharing:
- **No Third-Party Servers:** ArchiView is an offline-first desktop application. Your Google Drive data flows directly from your local computer to Google's servers. **We do not intercept, route, or store your Google Drive files or personal data on any third-party servers or our own databases.**
- **Real-Time Collaboration:** If you use the "Shared Vaults" feature, metadata and file changes may temporarily pass through our signaling Hub (hosted on Vercel) to facilitate real-time peer-to-peer synchronization and conflict resolution. The Hub does not persistently store your Google Drive files or personal information.
- **No Data Selling:** We do not sell, rent, or share your personal data or Google Drive data with anyone. 

## 3. Local Data Storage
By default, all data you create using ArchiView (including databases and attachments) is stored locally on your device's hard drive within the Workspace folder you select. You retain full control and ownership over this local data.

## 4. Crash Reports and Issue Tracking
If you choose to submit an issue report through the application, the information you provide (title, description, and basic platform information like your OS) is sent to us via a secure automated form strictly for the purpose of debugging and improving the software. No files from your workspace or Google Drive are sent automatically.

## 5. Changes to this Privacy Policy
We may update this Privacy Policy from time to time. Since the application is distributed as open-source software, any changes to data handling will be reflected in the source code and accompanied by an update to this document.

## 6. Contact Us
If you have any questions or concerns about this Privacy Policy or how ArchiView handles your data, please contact us by opening an issue on our GitHub repository: [https://github.com/AntonioOrf/Schedatore](https://github.com/AntonioOrf/Schedatore)
