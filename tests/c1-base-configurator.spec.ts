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
    it("adds bounded noise to the purposeful kernels when init is hybrid", () => {
        const g = 0.5;
        const noise = 0.5;
        const make = () =>
            configurator.generate(
                params({
                    spans: 2,
                    layers: 2,
                    gains: { influence: g, judgment: g, incentive: g },
                    matrixInit: { influence: "hybrid", judgment: "hybrid", incentive: "hybrid" },
                    hybridNoise: noise
                })
            );
        const a = make();
        const b = make();
        const purposefulJudgment = [
            [[-g], [g]],
            [[-g], [g]]
        ];
        for (let alpha = 0; alpha < a.agentCount; alpha++) {
            for (let sigma = 0; sigma < 2; sigma++) {
                for (let tau = 0; tau < 2; tau++) {
                    const j = a.agentSet.judgmentTensor[alpha][sigma][tau][0];
                    expect(Math.abs(j - purposefulJudgment[sigma][tau][0])).toBeLessThanOrEqual(noise * g);
                    // incentive noise covers every reporting dimension, the purposeful part only revenue
                    expect(a.agentSet.incentiveTensor[alpha][sigma][tau].length).toBe(8);
                }
            }
        }
        expect(a.agentSet.judgmentTensor).not.toEqual(
            Array.from({ length: a.agentCount }, () => purposefulJudgment)
        );
        expect(a.agentSet.judgmentTensor).not.toEqual(b.agentSet.judgmentTensor);
        // no influence between agents that are not connected in the org graph
        const graph = (a.plant as any).graph;
        expect(a.agentSet.influenceTensor[1][2][0][0] === 0).toBe(graph[1][2] === 0);
    });

    it("rejects spans or layers below 1", () => {
        expect(() => configurator.generate(params({ spans: 0, layers: 3 }))).toThrow();
        expect(() => configurator.generate(params({ spans: 2, layers: 0 }))).toThrow();
        expect(() => configurator.generate(params({ spans: 2.5, layers: 2 }))).toThrow();
    });

    it("does not share the defaults with callers", () => {
        const defaults = configurator.getDefaultParams();
        defaults.data.spans = 99;
        expect(configurator.getDefaultParams().data.spans).toBe(C1BaseConfiguratorDefaultData.spans);
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
