; Hooks installer NSIS cho LiveGuard.
;
; Bối cảnh: app bundle sidecar node.exe (chạy server Next standalone) + Prisma
; query engine (.node dll). Khi auto-updater cài bản mới, nếu sidecar của bản
; cũ còn sống (app bị kill đột ngột, sidecar mồ côi) thì dll .node bị giữ lock
; và NSIS treo vĩnh viễn ở dialog "Error opening file for writing".
;
; Hook chạy TRƯỚC khi copy file (cài mới, cập nhật) và TRƯỚC khi gỡ file:
;  - kill main exe theo image name (tên riêng của app — an toàn)
;  - kill node.exe CHỈ khi nó chạy từ thư mục cài đặt ($INSTDIR) — không đụng
;    node của dev server / dự án khác trên máy
;
; Lưu ý: sidecar đã được kill đúng lúc app thoát (RunEvent::Exit trong
; main.rs) — hook này là lưới an toàn cho trường hợp app bị tắt cứng
; (kill process, crash) hoặc updater thoát app bằng đường không qua Exit event.

!macro _CCC_KillRunningApp
  DetailPrint "Dừng LiveGuard đang chạy (nếu có)..."
  ; Main exe — tên duy nhất của app, kill theo image name là an toàn
  nsExec::Exec 'taskkill /F /IM crisis-command-center.exe /T'
  Pop $R0
  ; Sidecar node.exe — chỉ kill node chạy từ trong thư mục cài đặt
  nsExec::Exec `powershell -NoProfile -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $$_.Path -like '$INSTDIR\*' } | Stop-Process -Force"`
  Pop $R0
  Sleep 1500
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro _CCC_KillRunningApp
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro _CCC_KillRunningApp
!macroend
