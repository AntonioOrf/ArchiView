!macro customInit
  IfSilent skipCheck

  IfFileExists "$INSTDIR\ArchiView.exe" 0 skipCheck
    MessageBox MB_YESNO|MB_ICONQUESTION "ArchiView risulta già installato nel tuo sistema.$\r$\nVuoi procedere con l'aggiornamento o la reinstallazione?" IDYES skipCheck
    Quit

skipCheck:
!macroend
