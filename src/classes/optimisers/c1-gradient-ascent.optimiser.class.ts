import { Domain } from "domain";
import { C1GradientAscentOptimiserName, C1MatrixInitTypes } from "../../constants/c1.model.constants";
import { C1ConfiguratorParamData } from "../../interfaces/c1.interfaces";
import {
    GradientAscentOptimiser,
    Model,
    OptimiserStateDTO,
    States,
    ObjectHash,
    ConvergenceTestDTO,
    GradientAscentOptimiserData,
    DataPoint,
    GradientAscentOutput,
    ConfiguratorParamsDTO,
    GradientAscentParameters,
    SimSetDTO,
    DomainTypes
} from "aethon-arion-pipeline";

const flatten = require("flat");

export class C1GradientAscentOptimiser extends GradientAscentOptimiser<
    C1ConfiguratorParamData,
    GradientAscentParameters,
    GradientAscentOptimiserData<C1ConfiguratorParamData>
> {
    private _configuratorName: string;

    constructor(
        model: Model<
            C1ConfiguratorParamData,
            GradientAscentParameters,
            GradientAscentOptimiserData<C1ConfiguratorParamData>
        >,
        parameters: GradientAscentParameters
    ) {
        super(C1GradientAscentOptimiserName, model, parameters);
        this._configuratorName = this._model.getDefaultConfigurator().name;

        // testing code
        const step = this.step(undefined, undefined, {} as SimSetDTO);
        console.log(step)
    }

    initialise(): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        if (this._parameters) return this._step(true);
        else throw this._initError();
    }

    update(
        state: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>,
        results: ConvergenceTestDTO[]
    ): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        // get all the inputs required for the calculation
        const requiredInputs = this.getStateRequiredConfiguratorParams(state).map((input) => input.data);

        // calculate all the partial derivatives
        let completed: number = 0;
        for (let requiredInput of requiredInputs) {
            // first check if a result exists for the required input
            const hash = requiredInput.hash;
            const result = results.find((convergenceTest) => {
                return hash == convergenceTest.configuratorParams.hash;
            });
            if (!result) {
                throw new Error(`The required convergence output for config params hash ${hash} is missing`);
            }
            // ensure that the result is completed and converged
            if (result.state !== States.COMPLETED || !result.converged) {
                throw new Error(
                    `The required convergence output for config params hash ${hash} is not completed or converged`
                );
            }
            // convergence test has completed
            completed++;
            // assess whether the required input is for the x or the gradient
            if (state.optimiserData.x.hash == hash) {
                // update x
                state.optimiserData.x.configuratorParamData.performance = result.avgPerformance;
            } else {
                // update the partial derivative
                const partialDerivative = state.optimiserData.gradient.find(
                    (
                        partialDerivative: DataPoint<
                            ConfiguratorParamsDTO<C1ConfiguratorParamData>,
                            GradientAscentOutput
                        >
                    ) => {
                        return partialDerivative.data.inputs.hash == hash;
                    }
                );
                if (!partialDerivative) {
                    throw new Error(`The required partial derivative for config params hash ${hash} is missing`);
                }

                // update the partial derivative with the performance
                partialDerivative.performance = result.avgPerformance;

                // update the performance delta
                partialDerivative.performanceDelta =
                    result.avgPerformance - state.optimiserData.x.configuratorParamData.performance;

                // update the slope
                partialDerivative.xDelta === 0
                    ? (partialDerivative.slope = null)
                    : (partialDerivative.slope = partialDerivative.performanceDelta / partialDerivative.xDelta);

                // update the status
                partialDerivative.status = States.COMPLETED;
            }
        }

        // if all gradient elements and x have been updated, then the optimisation step is complete
        if (completed === state.optimiserData.gradient.length + 1) {
            state.status = States.COMPLETED;
            state.converged = this._testConvergence(state.optimiserData.gradient);
            state.percentComplete = 1;
        }
        return state;
    }

    step(
        stateDTO?: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>,
        resultsDTO?: ConvergenceTestDTO[],
        simSetDTO?: SimSetDTO
    ): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        if (stateDTO && resultsDTO) {
            return this._step(false, stateDTO, resultsDTO);
        } else if (simSetDTO) {
            return this._step(true, undefined, undefined, simSetDTO);
        } else {
            throw new Error("Invalid parameters for step; either provide a state and results or a simSet");
        }
    }

    // get the required configurator parameters for the current state; will returned array of structured objects
    // holding the ConfiguratorParameterData that will be required for all simulations the results of which will be
    // needed as inputs to asses the gradient and x values for the optimiser
    getStateRequiredConfiguratorParams(
        state: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>
    ): ConfiguratorParamsDTO<C1ConfiguratorParamData>[] {
        return state.optimiserData.dataPoints.map((dataPoint) => dataPoint.data.inputs);
    }

    private _step(
        init: boolean,
        state?: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>,
        results?: ConvergenceTestDTO[],
        simSetDTO?: SimSetDTO
    ): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        const newState: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> = {
            modelName: this.model.name,
            optimiserName: this.name,
            converged: false,
            percentComplete: 0,
            status: States.PENDING,
            optimiserData: {}
        } as OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>;

        // set the optimiser data
        newState.optimiserData.dataPoints = [];

        // check if this is an initialisation step
        if (init && simSetDTO) {
            newState.stepCount = 0;
            newState.simSet = simSetDTO;
            // it is, pick a random configuration within the configuration parameter space as the
            // initial x data point
            newState.optimiserData.dataPoints.push(this._getNewDataPoint("x", this._getRandomInit()));
        }
        if (!init && state && results) {
            // we are stepping out of an existing state
            newState.stepCount = state.stepCount + 1;
            newState.simSet = state.simSet;
            // copy the current x data point on which the new point will be based
            let xPrev: DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput> | undefined =
                state.optimiserData.dataPoints.find((dataPoint) => dataPoint.id === "x");
            if (xPrev) {
                for (let dataPoint of state.optimiserData.dataPoints) {
                    if (dataPoint.id !== "x") {
                        // STEP THE DATA POINT USING this._boundStep
                    }
                }
            } else {
                throw new Error("Could not find data point for x");
            }
        }

        // finally, generate the gradient data points
        newState.optimiserData.dataPoints = [
            ...newState.optimiserData.dataPoints,
            ...this._getGradient(newState.optimiserData.dataPoints[0])
        ];
        return newState;
    }

    private _getGradient(
        x: DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>
    ): DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>[] {
        if (this._parameters) {
            // this._validateConfiguratorParamData(x.data.inputs.data);
            // calculate the partial derivative along each optimisation dimension
            let del = [] as DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>[];
            const xConfigParams: C1ConfiguratorParamData = x.data.inputs.data;
            for (let key in this._parameterDomains) {
                const domain = this._parameterDomains[key];
                if (domain.optimise) {
                    // create a flat copy of the x configuration parameters
                    let copyOfXConfigFlat = flatten(JSON.parse(JSON.stringify(xConfigParams)));
                    // get the value of the parameter to be optimised
                    let xConfiguratorCurrentValue = copyOfXConfigFlat[key];
                    let xConfiguratorNewValue;
                    let xDelta: number = 0;
                    let xPlusXDelta: number = 0;
                    let xPlusDxOutput: GradientAscentOutput = {} as GradientAscentOutput;

                    // establish the xDelta and new value of x for the parameter to be optimised
                    if (domain.type === DomainTypes.DISCRETE || domain.type === DomainTypes.CONTINUOUS) {
                        xPlusXDelta = xConfiguratorCurrentValue;
                        if (xConfiguratorCurrentValue < domain.max) {
                            xDelta = Math.min(domain.derivativeStepSize, domain.max - xConfiguratorCurrentValue);
                        } else {
                            xDelta = -Math.min(domain.derivativeStepSize, xConfiguratorCurrentValue - domain.min);
                        }
                        xPlusXDelta += xDelta;
                        xConfiguratorNewValue = xPlusXDelta;
                    }
                    if (domain.type === DomainTypes.BOOLEAN) {
                        xDelta = xConfiguratorCurrentValue ? -1 : 1;
                        xPlusXDelta += xDelta;
                        xConfiguratorNewValue = xPlusXDelta ? true : false;
                    }
                    if (domain.type === DomainTypes.CATEGORICAL) {
                        xPlusXDelta = domain.categories.indexOf(xConfiguratorCurrentValue);
                        xDelta = xPlusXDelta + 1 < domain.categories.length ? 1 : -1;
                        xConfiguratorNewValue =
                            domain.categories[
                                (xPlusXDelta + xDelta + domain.categories.length) % domain.categories.length
                            ];
                        xPlusXDelta += xDelta;
                    }
                    // using the calculated values of the new x and xDelta, create a new data point
                    // that will be used to estimate the partial derivative along the optimisation dimension
                    // of the parameter key
                    copyOfXConfigFlat[key] = xPlusXDelta;
                    let xPlusDxConfigParams = flatten.unflatten(copyOfXConfigFlat);
                    xPlusDxOutput = {
                        configuratorParameterValue: xConfiguratorNewValue,
                        xPlusDelta: xPlusXDelta,
                        xDelta: xDelta
                    };

                    // addd the data point to the gradient estimation array
                    del.push(this._getNewDataPoint(key, xPlusDxConfigParams, xPlusDxOutput));
                }
            }
            return del;
        } else {
            throw this._initError();
        }
    }

    private _testConvergence(
        gradient: DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>[]
    ): boolean {
        return false;
    }

    protected _boundRandom(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    protected _boundStep(x: number, slope: number, min: number, max: number, round?: boolean): number {
        let value: number = x + slope * this._parameters.learningRate;
        if (round) value = Math.round(value);
        if (value < min) return min;
        if (value > max) return max;
        return value;
    }

    protected _validateConfiguratorParamData(configuratorParamData: C1ConfiguratorParamData): void {
        if (this._parameters) {
            // check that the point is within the parameter space
            if (
                !this._checkRange(
                    configuratorParamData.spans,
                    this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.spans[this._boundIndices.MAX]
                )
            )
                throw new Error("The number of spans must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.layers,
                    this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.layers[this._boundIndices.MAX]
                )
            )
                throw new Error("The number of layers must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.gains.influence,
                    this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.influence[this._boundIndices.MAX]
                )
            )
                throw new Error("The influence gain must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.gains.judgment,
                    this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.judgment[this._boundIndices.MAX]
                )
            )
                throw new Error("The judgment gain must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.gains.incentive,
                    this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.gains.incentive[this._boundIndices.MAX]
                )
            )
                throw new Error("The incentive gain must be within the range of the parameter space");
            if (
                !this._checkRange(
                    configuratorParamData.actionStateProbability,
                    this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MIN],
                    this._parameters.parameterSpaceDefinition.actionStateProbability[this._boundIndices.MAX]
                )
            )
                throw new Error("The action state probability must be within the range of the parameter space");
        } else {
            throw this._initError();
        }
    }

    protected _checkRange(value: number, min: number, max: number): boolean {
        return value >= min && value <= max;
    }

    protected _getNewDataPoint(
        id: string,
        configParams: C1ConfiguratorParamData,
        outputs: GradientAscentOutput = {} as GradientAscentOutput
    ): DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput> {
        return {
            id: id,
            data: {
                inputs: {
                    modelName: this._model.name,
                    configuratorName: this._configuratorName,
                    multipleOrgConfigs:
                        configParams.matrixInit.incentive === C1MatrixInitTypes.RANDOM ||
                        configParams.matrixInit.influence === C1MatrixInitTypes.RANDOM ||
                        configParams.matrixInit.judgment === C1MatrixInitTypes.RANDOM ||
                        configParams.matrixInit.judgment === C1MatrixInitTypes.HYBRID ||
                        configParams.matrixInit.influence === C1MatrixInitTypes.HYBRID ||
                        configParams.matrixInit.incentive === C1MatrixInitTypes.HYBRID,
                    data: configParams,
                    hash: new ObjectHash(configParams).toString()
                },
                outputs: outputs
            },
            status: States.PENDING
        };
    }

    private _getRandomInit(): C1ConfiguratorParamData {
        const randomInit: C1ConfiguratorParamData = {} as C1ConfiguratorParamData;
        // return a random point in the parameter space

        for (const key in this._parameterDomains) {
            const domain = this._parameterDomains[key];
            if (!domain.optimise) randomInit[key] = domain.default;
            else {
                switch (domain.type) {
                    case DomainTypes.DISCRETE:
                        randomInit[key] = Math.floor(Math.random() * (domain.max - domain.min + 1)) + domain.min;
                        break;
                    case DomainTypes.CONTINUOUS:
                        randomInit[key] = this._boundRandom(domain.min, domain.max);
                        break;
                    case DomainTypes.BOOLEAN:
                        randomInit[key] = Math.random() < 0.5;
                        break;
                    case DomainTypes.CATEGORICAL:
                        if (domain.categories) {
                            randomInit[key] = domain.categories[Math.floor(Math.random() * domain.categories.length)];
                        } else {
                            throw new Error(`The parameter ${key} is categorical but has no categories defined`);
                        }
                        break;
                }
            }
        }
        return flatten.unflatten(randomInit);
    }
}
