import fs from "fs";
import type { Strapi } from "@strapi/types";
import { nonNull } from "nexus";
// import type * as Nexus from "nexus";
import { parse } from "csv-parse/sync";

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register({ strapi }) {
    const extensionService = strapi.plugin("graphql").service("extension");
    extensionService.use(
      ({ nexus, strapi }: { nexus: any; strapi: Strapi }) => {
        return {
          types: [
            nexus.extendType({
              type: "Politician",
              definition(t) {
                t.list.field("stats", {
                  type: nonNull("PoliticianHonestyStat"),
                  resolve: async (parent) => {
                    const { id } = parent;

                    return strapi.db.connection
                      .raw(`SELECT COUNT(statements.id) as "count", statements.label
                    FROM politicians
                    INNER JOIN statements_politician_links ON statements_politician_links.politician_id = politicians.id
                    INNER JOIN statements ON statements.id = statements_politician_links.statement_id
                    WHERE politicians.id = ${id}
                    GROUP BY statements_politician_links.politician_id, statements.label`);
                  },
                });
              },
            }),
            nexus.objectType({
              name: "PoliticianHonestyStat",
              definition(t) {
                t.nonNull.field("label", {
                  type: "ENUM_STATEMENT_LABEL",
                });
                t.nonNull.int("count");
              },
            }),
          ],
        };
      }
    );
  },

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    const statements = await strapi.entityService.findMany(
      "api::statement.statement"
    );

    if (statements.length !== 0) {
      return;
    }

    try {
      const records = parse(fs.readFileSync("./fixtures/data.csv", "utf8"), {
        delimiter: ";",
        skip_empty_lines: true,
      }).map(([id, label, statement, subject, name, job, state, party]) => ({
        id,
        label,
        statement,
        subject,
        name,
        job,
        state,
        party,
      }));

      const getOrCreatePolitician = async ({
        name,
        job,
        party,
        state,
      }: {
        name: string;
        job: string;
        party: string;
        state: string;
      }) => {
        const results = await strapi.entityService.findMany(
          "api::politician.politician",
          {
            filters: {
              name,
            },
          }
        );
        let politician = results.length !== 0 ? results[0] : null;

        if (politician) {
          return politician;
        }

        return strapi.entityService.create("api::politician.politician", {
          data: {
            name,
            job,
            state,
            party,
          },
        });
      };

      const mapLabel = (label: string): string => {
        switch (label.toLowerCase()) {
          case "false":
            return "lie";
          case "true":
            return "truth";
          default:
            return label.toLowerCase();
        }
      };

      for (let i = 0; i < records.length; i++) {
        const { id, label, statement, subject, name, job, state, party } =
          records[i];

        const politician = await getOrCreatePolitician({
          name,
          job,
          party,
          state,
        });
        await strapi.entityService.create("api::statement.statement", {
          data: {
            politician: politician.id,
            label: mapLabel(label),
            statement,
            subject,
          },
        });
      }
    } catch (err) {
      console.error(err);
    }
  },
};
