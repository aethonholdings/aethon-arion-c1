import { ResultDTO, ResultSet, Utils } from "aethon-arion-pipeline";
import { C1ConfiguratorParamsDTO, C1ConfiguratorParamSegment } from "../../interfaces/c1.model.interfaces";
import { C1RegressionInputVariableColumnIndices, C1ReportingVariablesIndex } from "../../constants/c1.model.constants";
import MLR from "ml-regression-multivariate-linear";

export class C1ResultSet extends ResultSet {
    private segments: C1ConfiguratorParamSegment[] = [];
    private regressionInputNames: string[] = [
        "Agent Count",
        "Influence: null",
        "Influence: random",
        "Influence: hybrid",
        "Influence: purposeful",
        "Judgment: null",
        "Judgment: random",
        "Judgment: hybrid",
        "Judgment: purposeful",
        "Incentive: null",
        "Incentive: random",
        "Incentive: hybrid",
        "Incentive: purposeful",
        "Influence Gain",
        "Judgment Gain",
        "Incentive Gain",
        "Clock Ticks"
    ];
    private inputVariableCount: number = this.regressionInputNames.length;
    private outputVariableNames: string[] = ["Revenue per Agent"];
    private resultSegmentMap: Map<C1ConfiguratorParamSegment, ResultDTO[]> = new Map<
        C1ConfiguratorParamSegment,
        ResultDTO[]
    >();

    constructor(results: ResultDTO[], histogramBinCount: number) {
        super(results, histogramBinCount);
        this.segments = this._getSegments();
        this.results.forEach((result: ResultDTO) => {
            let segment = this.segments?.find((segment) => {
                return (
                    segment.matrixInit?.influence === result.configuratorParams?.data.matrixInit.influence &&
                    segment.matrixInit?.judgment === result.configuratorParams?.data.matrixInit.judgment &&
                    segment.matrixInit?.incentive === result.configuratorParams?.data.matrixInit.incentive &&
                    segment.gains?.influence === result.configuratorParams?.data.gains.influence &&
                    segment.gains?.judgment === result.configuratorParams?.data.gains.judgment &&
                    segment.gains?.incentive === result.configuratorParams?.data.gains.incentive &&
                    segment.clockTicks === result.reporting[C1ReportingVariablesIndex.CLOCK_TICKS] &&
                    segment.agentCount === result.agentCount
                );
            });
            if (segment) {
                if (this.resultSegmentMap.has(segment)) {
                    let values = this.resultSegmentMap.get(segment)?.push(result);
                } else {
                    this.resultSegmentMap?.set(segment, [result]);
                }
            }
        });
    }

    getSegmentAverageRevenue(segment: C1ConfiguratorParamSegment): number | null {
        let results = this.resultSegmentMap.get(segment);
        if (results && results.length > 0) {
            let revenue = 0;
            results?.forEach((result) => {
                revenue += result.reporting[C1ReportingVariablesIndex.REVENUE];
            });
            return revenue / results.length;
        }
        return null;
    }

    getSegmentAverageAgentPerformance(segment: C1ConfiguratorParamSegment): number | null {
        const revenue = this.getSegmentAverageRevenue(segment);
        if (revenue && segment.agentCount) return revenue / segment.agentCount;
        return null;
    }

    getAgentPerformanceRegression(): {
        regressionResults: any;
        inputVariableNames: string[];
        outputVariableNames: string[];
    } {
        let error: boolean = false;
        let inputMatrix: number[][] = this.results.map((result: ResultDTO) => {
            let row: number[] = Utils.tensor([this.inputVariableCount], () => 0) as number[];

            const configuratorParams = result.configuratorParams as C1ConfiguratorParamsDTO;
            result.agentCount
                ? (row[C1RegressionInputVariableColumnIndices.AGENT_COUNT] = result.agentCount)
                : (error = true);
            // set up regression dummy variables for the different configuration options in the matrix configurator
            configuratorParams.data.matrixInit.influence === "null"
                ? (row[C1RegressionInputVariableColumnIndices.INFLUENCE_NULL] = 1)
                : null;
            configuratorParams.data.matrixInit.influence === "random"
                ? (row[C1RegressionInputVariableColumnIndices.INFLUENCE_RANDOM] = 1)
                : null;
            configuratorParams.data.matrixInit.influence === "hybrid"
                ? (row[C1RegressionInputVariableColumnIndices.INFLUENCE_HYBRID] = 1)
                : null;
            configuratorParams.data.matrixInit.influence === "purposeful"
                ? (row[C1RegressionInputVariableColumnIndices.INFLUENCE_PURPOSEFUL] = 1)
                : null;
            configuratorParams.data.matrixInit.incentive === "null"
                ? (row[C1RegressionInputVariableColumnIndices.INCENTIVE_NULL] = 1)
                : null;
            configuratorParams.data.matrixInit.incentive === "random"
                ? (row[C1RegressionInputVariableColumnIndices.INCENTIVE_RANDOM] = 1)
                : null;
            configuratorParams.data.matrixInit.incentive === "hybrid"
                ? (row[C1RegressionInputVariableColumnIndices.INCENTIVE_HYBRID] = 1)
                : null;
            configuratorParams.data.matrixInit.incentive === "purposeful"
                ? (row[C1RegressionInputVariableColumnIndices.INCENTIVE_PURPOSEFUL] = 1)
                : null;
            configuratorParams.data.matrixInit.judgment === "null"
                ? (row[C1RegressionInputVariableColumnIndices.JUDGMENT_NULL] = 1)
                : null;
            configuratorParams.data.matrixInit.judgment === "random"
                ? (row[C1RegressionInputVariableColumnIndices.JUDGMENT_RANDOM] = 1)
                : null;
            configuratorParams.data.matrixInit.judgment === "hybrid"
                ? (row[C1RegressionInputVariableColumnIndices.JUDGMENT_HUBRID] = 1)
                : null;
            configuratorParams.data.matrixInit.judgment === "purposeful"
                ? (row[C1RegressionInputVariableColumnIndices.JUDGMENT_PURPOSEFUL] = 1)
                : null;
            // set up regression variables for the gains
            configuratorParams.data.gains.influence
                ? (row[C1RegressionInputVariableColumnIndices.INFLUENCE_GAIN] = configuratorParams.data.gains.influence)
                : (error = true);
            configuratorParams.data.gains.judgment
                ? (row[C1RegressionInputVariableColumnIndices.JUDGMENT_GAIN] = configuratorParams.data.gains.judgment)
                : (error = true);
            configuratorParams.data.gains.incentive
                ? (row[C1RegressionInputVariableColumnIndices.INCENTIVE_GAIN] = configuratorParams.data.gains.incentive)
                : (error = true);
            // set up regression variable for the clock ticks
            row[C1RegressionInputVariableColumnIndices.CLOCK_TICKS] =
                result.reporting[C1ReportingVariablesIndex.CLOCK_TICKS];
            return row;
        });
        let outputMatrix: number[][] = this.results.map((result: ResultDTO) => {
            let row: number[] = Utils.tensor([1], () => 0) as number[];
            row[0] = result.performance as number;
            return row;
        });
        if (error) throw new Error("Result set regression error");
        const mlr = new MLR(inputMatrix, outputMatrix, { intercept: true, statistics: true });
        let mlrJson: any = mlr.toJSON();
        for (let index = 0; index < mlrJson.summary.variables.length - 1; index++) {
            mlrJson.summary.variables[index].label = this.regressionInputNames[index];
        }
        return {
            regressionResults: mlrJson,
            inputVariableNames: this.regressionInputNames,
            outputVariableNames: this.outputVariableNames
        };
    }

    getSegments(): C1ConfiguratorParamSegment[] {
        if (!this.segments) this.segments = this._getSegments();
        return this.segments;
    }

    filter(filter: C1ConfiguratorParamSegment): C1ResultSet {
        // this is not exhaustively implemented yet
        let results = JSON.parse(JSON.stringify(this.results));
        if (filter?.matrixInit?.influence)
            results = results.filter(
                (result: ResultDTO) =>
                    result.configuratorParams?.data.matrixInit.influence === filter?.matrixInit?.influence
            );
        if (filter?.matrixInit?.judgment)
            results = results.filter(
                (result: ResultDTO) =>
                    result.configuratorParams?.data.matrixInit.judgment === filter?.matrixInit?.judgment
            );
        if (filter?.matrixInit?.incentive)
            results = results.filter(
                (result: ResultDTO) =>
                    result.configuratorParams?.data.matrixInit.incentive === filter?.matrixInit?.incentive
            );
        if (filter?.gains?.influence)
            results = results.filter(
                (result: ResultDTO) => result.configuratorParams?.data.gains.influence === filter?.gains?.influence
            );
        if (filter?.gains?.judgment)
            results = results.filter(
                (result: ResultDTO) => result.configuratorParams?.data.gains.judgment === filter?.gains?.judgment
            );
        if (filter?.gains?.incentive)
            results = results.filter(
                (result: ResultDTO) => result.configuratorParams?.data.gains.incentive === filter?.gains?.incentive
            );
        if (filter.clockTicks)
            results = results.filter(
                (result: ResultDTO) => result.reporting[C1ReportingVariablesIndex.CLOCK_TICKS] === filter.clockTicks
            );
        if (filter.agentCount) results = results.filter((result: ResultDTO) => result.agentCount === filter.agentCount);
        if (
            filter?.matrixInit?.influence ||
            filter?.matrixInit?.judgment ||
            filter?.matrixInit?.incentive ||
            filter?.gains?.influence ||
            filter?.gains?.judgment ||
            filter?.gains?.incentive ||
            filter?.clockTicks ||
            filter?.agentCount
        ) {
            return new C1ResultSet(results, this.histogramBinCount);
        } else {
            return this;
        }
    }

    private _getSegments(): C1ConfiguratorParamSegment[] {
        let segments: C1ConfiguratorParamSegment[] = [];
        this.results.forEach((result: ResultDTO) => {
            const configuratorParams = result.configuratorParams as C1ConfiguratorParamsDTO;
            const segment: C1ConfiguratorParamSegment = {
                matrixInit: {
                    influence: configuratorParams.data.matrixInit.influence,
                    judgment: configuratorParams.data.matrixInit.judgment,
                    incentive: configuratorParams.data.matrixInit.incentive
                },
                gains: {
                    influence: configuratorParams.data.gains.influence,
                    judgment: configuratorParams.data.gains.judgment,
                    incentive: configuratorParams.data.gains.incentive
                },
                clockTicks: result.reporting[C1ReportingVariablesIndex.CLOCK_TICKS],
                agentCount: result.agentCount as number
            };
            // THIS IS NOT CORRECT
            if (
                !segments.some((s: C1ConfiguratorParamSegment) => {
                    return (
                        s?.matrixInit?.influence === segment?.matrixInit?.influence &&
                        s?.matrixInit?.judgment === segment?.matrixInit?.judgment &&
                        s?.matrixInit?.incentive === segment?.matrixInit?.incentive &&
                        s?.gains?.influence === segment?.gains?.influence &&
                        s?.gains?.judgment === segment?.gains?.judgment &&
                        s?.gains?.incentive === segment?.gains?.incentive &&
                        s.clockTicks === segment.clockTicks &&
                        s.agentCount === segment.agentCount
                    );
                })
            )
                segments.push(segment);
        });
        this.segments = segments;
        return this.segments;
    }

    getResultSegmentMap(): Map<C1ConfiguratorParamSegment, ResultDTO[]> | null {
        if (this.resultSegmentMap) return this.resultSegmentMap;
        else return null;
    }
}
