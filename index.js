
import express from "express";
import bodyParser from "body-parser";
import pg from "pg";

const app = express();
const port = process.env.PORT || 3000;

const db = new pg.Client(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        user: "postgres",
        host: "localhost",
        database: "postgres",
        password: process.env.LOCAL_DB_PASSWORD,
        port: 5432,
      }
);

await db.connect();
console.log("Connected to PostgreSQL successfully!");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

async function checkVisited() {
  const result = await db.query(
    "SELECT country_code FROM travel_tracker.visited_countries"
  );

  const countries = [];
  result.rows.forEach((country) => {
    countries.push(country.country_code);
  });

  return countries;
}

app.get("/", async (req, res) => {
  try {
    const countries = await checkVisited();

    res.render("index.ejs", {
      countries: countries,
      total: countries.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Unable to load visited countries.");
  }
});

// Insert a new country
app.post("/add", async (req, res) => {
  const input = req.body["country"];

  try {
    const result = await db.query(
      `SELECT country_code
       FROM travel_tracker.countries
       WHERE LOWER(country_name) LIKE '%' || $1 || '%';`,
      [input.toLowerCase()]
    );

    const data = result.rows[0];

    if (!data) {
      const countries = await checkVisited();

      return res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        error: "Country name does not exist, Try again",
      });
    }

    const countryCode = data.country_code;

    try {
      await db.query(
        `INSERT INTO travel_tracker.visited_countries (country_code)
         VALUES ($1)`,
        [countryCode]
      );

      res.redirect("/");
    } catch (err) {
      console.error(err);

      const countries = await checkVisited();

      res.render("index.ejs", {
        countries: countries,
        total: countries.length,
        error: "Country has already been added, Try again",
      });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error. Check Render logs.");
  }
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});
