_Read this in [Italian](README-it.md)_

<img padding=20i width="1920" height="1280" alt="914_1x_shots_so" src="https://github.com/user-attachments/assets/973bffbb-f596-47ad-97d3-151f5f10075b" />

# ArchiView

**ArchiView** is a desktop application (built with Electron) designed as an offline management tool to catalog, archive, and transcribe manuscripts and historical documents.

## Integrated Transcription Environment

<img width="1920" height="1280" alt="83_1x_shots_so" src="https://github.com/user-attachments/assets/07bbe09f-12a6-4948-abac-83dd21c9fe0e" />

A text editor with a "split-screen" view to comfortably display the original images or PDFs of the document side-by-side during transcription work.

## Modular Data Management

<img width="1920" height="1280" alt="832_1x_shots_so" src="https://github.com/user-attachments/assets/ecd03e76-77de-4eff-b733-ad6bbea0b084" />

The core of the application relies on a fully dynamic document template system. You can use predefined templates (Notarial deeds, Judicial acts, Tax documents) or assemble new document types by choosing only the data fields you actually need (Title, Authors, Shelfmark, Medium, etc.). The interface will automatically adapt to the chosen template.

## Additional Features

- **Folder Organization**: Manage your archives in a hierarchical structure of folders and subfolders for perfect organization.
- **Attachment Management**: Attach and view scans, photographs, or PDF files associated with your records directly within the application.
- **Advanced Search and Tags**: Quickly find any record through global text search or by filtering the archive via associated tags.
- **Open and Independent Data Format**: No proprietary databases or cloud lock-in (no vendor lock-in). The entire data lifecycle takes place offline on your device. Documents are saved within your Workspace folder in a structured JSON format, which is clear, inspectable, and easily manipulable even outside the application.
- **Portability and Instant Backup**: You have total and material control over your data. Simply copy your Workspace folder to a USB drive to transfer the entire project to another computer. Additionally, a native feature is integrated to generate your entire archive (JSON database and attached files) into a convenient backup ZIP file with a single click.

## Download and Installation:

The easiest way to use **ArchiView** is to download the latest release:

1. Go to the [Releases](https://github.com/AntonioOrf/Schedatore/releases) page of the project on GitHub.
2. Download the executable file for your operating system.
3. Run the downloaded file directly.

---

## For Developers (Building from source)

If you want to modify the code or run the application in a development environment, make sure you have [Node.js](https://nodejs.org/) installed on your system, then:

1. Clone this repository or extract the project files.
2. Open the terminal in the root directory (where the `package.json` file is located).
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   npm start
   ```

### Creating the Executable

If you want to package the application to create an executable (e.g., for Windows):

```bash
npm run pack
```

This command, thanks to `electron-builder`, will create a portable package in the `dist` folder.

## First Launch

Upon first launch, ArchiView will ask you to select a **Workspace** folder.
Choose an empty and safe directory on your hard drive: inside it, the app will automatically create:

- The `database_manoscritti.json` file (where all texts and metadata will be saved).
- The `allegati_manoscritti` folder (where images and PDFs you attach to your records will be copied).
  You can always change the workspace folder later from the **Settings**.

## Technologies Used

- [Electron](https://www.electronjs.org/) for the desktop framework.
- [Tailwind CSS](https://tailwindcss.com/) for UI styling.
- [Lucide Icons](https://lucide.dev/) for icons.

## License

See the [LICENSE](LICENSE) file for more information on the terms of use.
