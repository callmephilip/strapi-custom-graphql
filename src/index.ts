import type { Strapi } from "@strapi/types";
import type * as Nexus from "nexus";
import { nonNull } from "nexus";
import { loadData } from "./lib/data";

type Nexus = typeof Nexus;

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
      ({ nexus, strapi }: { nexus: Nexus; strapi: Strapi }) => {
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
    await loadData({ strapi });
  },
};
