@echo off
rem Run once, as administrator. Opens ports 3000 and 4000 to the local
rem network only - not to the internet.
netsh advfirewall firewall add rule name="PARAFRAZ frontend" dir=in action=allow protocol=TCP localport=3000 profile=private
netsh advfirewall firewall add rule name="PARAFRAZ backend" dir=in action=allow protocol=TCP localport=4000 profile=private
echo.
echo Done. Ports 3000 and 4000 are open on private networks.
pause
