workdir=$(cd $(dirname $0); pwd)
cd $workdir/../fish-client
pwd
service fish stop
git clean -d -fx
git reset --hard
git pull origin master
unzip -o -P321321lqp config.zip
npm install --unsafe-perm
service fish start
