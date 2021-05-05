
async function main() {
  const fs = require("fs");
  const fileName = "./committee-example.json";

  var data = JSON.parse(fs.readFileSync(fileName,
                             {encoding:'utf8', flag:'r'}));

  var pgp = fs.readFileSync("./scripts/test_key.pgp",
                            {encoding:'utf8', flag:'r'});
  data["communication-channel"]["pgp-pk"] = pgp;

  fs.writeFileSync(
    fileName,
    JSON.stringify(data, undefined, 2)
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
