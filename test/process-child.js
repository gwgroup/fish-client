console.log('child', process.argv[2], process.argv[3]);
setTimeout(() => {
  process.send({ a: 100 });
}, 4000);
