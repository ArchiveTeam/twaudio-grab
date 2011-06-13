#!/bin/bash
#
# Version 3: Solve problem with profile image in grep output.
# Version 2: Handle expiration of Amazon S3 signatures.
# Version 1.
#
# Download the newest mp3 files from a Twaud.io user.
# (Only those mp3's that are listed in the RSS feed.)
#
# Usage:  ./twaudiorip.sh ${USERNAME}
#

USERNAME=$1

# USER_AGENT="FeedFetcher-Google; (+http://www.google.com/feedfetcher.html)"
USER_AGENT="Googlebot/2.1 (+http://www.googlebot.com/bot.html)"

DATADIR=data/${USERNAME:0:1}/${USERNAME:0:2}/${USERNAME:0:3}/${USERNAME:0:4}/${USERNAME}

START=$(date +%s)

# incomplete result from a previous run?
if [ -f $DATADIR/.incomplete ]
then
  echo "Deleting incomplete download of $USERNAME..."
  rm -rf $DATADIR
fi

if [ -d $DATADIR ]
then
  echo "$USERNAME already downloaded."
  exit 2
fi

echo "Downloading ${USERNAME}:"

# create directory
mkdir -p $DATADIR
touch $DATADIR/.incomplete

# grab profile page
wget -nv -q -nc -U "$USER_AGENT" -O $DATADIR/index.html "http://twaud.io/users/${USERNAME}"

# grab rss feed
wget -nv -q -nc -U "$USER_AGENT" -O $DATADIR/rss.xml "http://twaud.io/users/${USERNAME}.xml"

download_finished=0
while [[ $download_finished -ne 1 ]]
do
  # find urls
  # grep output: first line contains audio id,  http://twaud.io/audio/$ID
  #              second line contains s3 url of mp3
  audio_files=`grep -o -E 'http://twaud.io/audio/[^<]+|http://s3.amazonaws.com/twaudio-production[^"]+' $DATADIR/rss.xml`

  download_finished=1
  # parse
  for line in $audio_files
  do
    if [[ $line =~ twaud.io/audio/ ]]
    then
      # extract clip id from url (http://twaud.io/audio/$ID)
      cur_clip_id=${line:22}

    else
      if [[ $line =~ s3.amazonaws.com ]]
      then
        echo " - clip ${cur_clip_id}"
        # download clip
        url=${line//&amp;/&}
        if [[ ! -f $DATADIR/${cur_clip_id}.mp3 ]]
        then
          wget_header_file=wget_out_$$
          wget -q -nc -U "$USER_AGENT" -O $DATADIR/${cur_clip_id}.mp3 "$url" -S 2>$wget_header_file
          wget_headers=`cat $wget_header_file`
          rm -f $wget_header_file

          if [[ ! $wget_headers =~ 200 ]]
          then
            if [[ $wget_headers =~ Forbidden ]]
            then
              echo " -- expired, redownload RSS feed for fresh signatures"
              rm $DATADIR/rss.xml
              wget -nv -q -nc -U "$USER_AGENT" -O $DATADIR/rss.xml "http://twaud.io/users/${USERNAME}.xml"
              download_finished=0
              break
            else
              echo "ERROR: wget returned an error on ${url}! See $DATADIR/wget.log"
              echo $wget_headers >> $DATADIR/wget.log
            fi
          fi
        fi

        # download html
        wget -nv -q -nc -U "$USER_AGENT" -O $DATADIR/${cur_clip_id}.html "http://twaud.io/${cur_clip_id}"
      fi
    fi
  done
done

rm $DATADIR/.incomplete

END=$(date +%s)
DIFF=$(( $END - $START ))

echo " Done. ($DIFF seconds)"


