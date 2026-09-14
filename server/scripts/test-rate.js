const http = require("http");
const data = JSON.stringify({username:"admin",password:"wrong"});
for (let i = 0; i < 6; i++) {
  const req = http.request({hostname:"127.0.0.1",port:3000,method:"POST",path:"/api/v1/auth/login",headers:{"Content-Type":"application/json","Content-Length":Buffer.byteLength(data),"X-Forwarded-For":"1.2.3."+i}}, res => {
    let b=""; res.on("data",c=>b+=c);
    res.on("end",() => {
      const r = JSON.parse(b);
      console.log("IP 1.2.3."+i+": " + r.message);
    });
  });
  req.write(data); req.end();
}
