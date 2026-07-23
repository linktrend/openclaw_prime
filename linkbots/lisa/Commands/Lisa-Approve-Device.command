#!/bin/zsh
# Approve newest pending Lisa device pairing and apply a label.
# Real logic: ~/.openclaw-lisa/bin/approve-latest-device
# Home: ~/Documents/LiNKwork/Openclaw\ Lisa\ Prime/Commands/
cd ~
echo "Lisa — approve latest pending device"
echo "Examples: MacBook | iPhone | Mac Mini"
echo "Leave blank to auto-guess from client/platform."
echo -n "Label [auto]: "
read -r label
if [[ -n "$label" ]]; then
  /Users/linktrend/.openclaw-lisa/bin/approve-latest-device "$label"
else
  /Users/linktrend/.openclaw-lisa/bin/approve-latest-device
fi
echo
read -k '?Press any key to close…'
