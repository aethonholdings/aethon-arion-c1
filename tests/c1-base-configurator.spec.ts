import { C1, C1BaseConfiguratorDefaultData, C1ConfiguratorNames } from "../src/constants/c1.model.constants";
import { C1ConfiguratorParamData } from "../src/interfaces/c1.interfaces";
import { ConfiguratorParamsDTO } from "aethon-arion-pipeline";

const configurator = C1.getConfigurator(C1ConfiguratorNames.BASE);

const params = (overrides: Partial<C1ConfiguratorParamData>): ConfiguratorParamsDTO<C1ConfiguratorParamData> => ({
    modelName: "C1",
    configuratorName: C1ConfiguratorNames.BASE,
    multipleOrgConfigs: true,
    data: { ...JSON.parse(JSON.stringify(C1BaseConfiguratorDefaultData)), ...overrides }
});

describe("C1BaseConfigurator", () => {
    it("applies the purposeful judgment kernel when judgment init is hybrid", () => {
        const g = 0.5;
        const orgConfig = configurator.generate(
            params({
                spans: 2,
                layers: 2,
                gains: { influence: 0, judgment: g, incentive: 0 },
                matrixInit: { influence: "null", judgment: "hybrid", incentive: "null" }
            })
        );
        for (const agentKernel of orgConfig.agentSet.judgmentTensor) {
            expect(agentKernel).toEqual([
                [[-g], [g]],
                [[-g], [g]]
            ]);
        }
    });

    it("does not apply the purposeful judgment kernel when only influence init is hybrid", () => {
        const orgConfig = configurator.generate(
            params({
                spans: 2,
                layers: 2,
                gains: { influence: 0.1, judgment: 0.5, incentive: 0 },
                matrixInit: { influence: "hybrid", judgment: "null", incentive: "null" }
            })
        );
        for (const agentKernel of orgConfig.agentSet.judgmentTensor) {
            expect(agentKernel).toEqual([
                [[0], [0]],
                [[0], [0]]
            ]);
        }
    });

    it("uses the unit price and unit payroll from the configurator parameters", () => {
        const orgConfig = configurator.generate(params({ reporting: { unitPrice: 3, unitPayroll: 2 } }));
        expect(orgConfig.reporting).toEqual({ unitPrice: 3, unitPayroll: 2 });
    });

    it("falls back to default reporting values when none are supplied", () => {
        const p = params({});
        delete (p.data as any).reporting;
        const orgConfig = configurator.generate(p);
        expect(orgConfig.reporting).toEqual(C1BaseConfiguratorDefaultData.reporting);
    });

    // expected graph: tree edges (parent(a) = floor((a - 1) / s)) plus, for "teams", cliques among siblings
    const expectedGraph = (s: number, l: number, teams: boolean): number[][] => {
        const n = s > 1 ? (s ** l - 1) / (s - 1) : l;
        const g = Array.from({ length: n }, () => new Array<number>(n).fill(0));
        const parent = (a: number) => (s > 1 ? Math.floor((a - 1) / s) : a - 1);
        for (let a = 1; a < n; a++) {
            g[a][parent(a)] = g[parent(a)][a] = 1;
            if (teams && s > 1) {
                for (let b = 1; b < n; b++) {
                    if (b !== a && parent(b) === parent(a)) g[a][b] = 1;
                }
            }
        }
        return g;
    };

    for (const [s, l] of [
        [2, 2],
        [2, 3],
        [3, 2],
        [3, 3],
        [4, 3],
        [1, 4]
    ]) {
        for (const graph of ["teams", "top-down"] as const) {
            it(`builds the ${graph} org graph for spans=${s}, layers=${l}`, () => {
                const orgConfig = configurator.generate(params({ spans: s, layers: l, graph }));
                expect((orgConfig.plant as any).graph).toEqual(expectedGraph(s, l, graph === "teams"));
            });
        }
    }
});
