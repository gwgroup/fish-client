var a = setTimeout((code) => { util.log(code); }, 5000, "aaaaa");

a.unref()