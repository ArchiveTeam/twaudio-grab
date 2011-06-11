#!/bin/bash
#
# Download the Twaud.io archive listings.
#

START_PAGE=1
END_PAGE=5588

USER_AGENT="Googlebot/2.1 (+http://www.googlebot.com/bot.html)"

mkdir -p data/archivelists

page=$START_PAGE
while [[ $page -le $END_PAGE ]]
do
  echo $page
  if [ ! -f data/archivelists/${page}.html ]
  then
    wget -U "$USER_AGENT" -O archive.tmp "http://twaud.io/archive?page=${page}"
    mv archive.tmp data/archivelists/${page}.html

    sleep 1
  fi

  page=$((page + 1))
done


