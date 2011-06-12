#!/bin/bash
#
# Version 1.
#
# Downloads Twaud.io profiles from a global queue:
#  1. requests a username from the tracker
#  2. runs twaudiorip.sh to download the data for this user
#  3. marks the user as 'completed' on the tracker
#
# Usage:  ./twaudiorip-runner.sh
#
# touch STOP  in the script's directory to make it stop after
# the current user is done.
#

while [ ! -f STOP ]
do
  echo "Requesting username..."
  username=`wget -O - -q --post-data="" "http://twaudio-tracker.heroku.com/request"`

  if [[ ${#username} -gt 0 ]]
  then
    echo "Downloading $username"
    ./twaudiorip.sh $username >> $$.log
    
    echo "Marking $username as completed"
    wget -O /dev/null -q --post-data="" "http://twaudio-tracker.heroku.com/done/${username}"

  else
    echo "No username available. All done?"
    exit
  fi
done

