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
    DomainTypes,
    Domain
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
    }

    initialise(simSetDTO: SimSetDTO): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        return this._step(true, undefined, simSetDTO);
    }

    step(
        stateDTO?: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>,
        resultsDTO?: ConvergenceTestDTO[]
    ): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        if (stateDTO && resultsDTO) {
            return this._step(false, stateDTO);
        } else {
            throw new Error("Optimiser step requires a state and resultDTO");
        }
    }

    update(
        state: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>,
        results: ConvergenceTestDTO[]
    ): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        // check if all results required by the state have been received
        if (state && results) {
            // find the x data point that the gradient ascent is based on
            const x = state.optimiserData.dataPoints.find((dataPoint) => dataPoint.id === "x");
            // find the simulation convergence test result corresponding to x because
            // we will need to access the current estimate of simulation performance
            const xResult = results.find((result) => result.configuratorParams.hash === x?.data.inputs.hash);

            let completed: boolean = true;
            let running: boolean = false;
            let failed: boolean = false;

            // cycle through all the required data points for gradient descent and find the corresponding
            // simulation ConvergenceTest result.  Then calculate the current estimated outputs for each
            for (let requiredDataPoint of state.optimiserData.dataPoints) {
                const result = results.find(
                    (result) => result.configuratorParams.hash === requiredDataPoint.data.inputs.hash
                );
                if (!result) throw new Error(`Not all results were received for optimiserStateId: ${state.id}`);
                else {
                    const domain = this._parameterDomains[requiredDataPoint.id];
                    requiredDataPoint.status = result.state;
                    if (requiredDataPoint.id === "x") state.performance = result.avgPerformance;
                    // determine the state of overall optimisation step flags based on the state
                    // of the result data points
                    if (requiredDataPoint.status !== States.COMPLETED) completed = false;
                    if (requiredDataPoint.status === States.RUNNING) running = true;
                    if (requiredDataPoint.status === States.FAILED) failed = true;

                    // for all parameters, update the output performance value
                    // store the current value in prevPerformance before doing so
                    // as it will be needed to assess which category is showing improved performance
                    // for categorical variable domains
                    let prevPerformance = requiredDataPoint.data.outputs.performance
                        ? requiredDataPoint.data.outputs.performance
                        : result.avgPerformance; // store the previous value; we will need it
                    requiredDataPoint.data.outputs.performance = result.avgPerformance; // update to the current result value

                    if (
                        requiredDataPoint.id !== "x" &&
                        (requiredDataPoint.status === States.COMPLETED || result.state === States.RUNNING)
                    ) {
                        // for categorical domain parameters, update the output next step category
                        // maximising performance
                        if (
                            prevPerformance &&
                            requiredDataPoint.data.outputs.performance &&
                            requiredDataPoint.data.outputs.performance > prevPerformance &&
                            domain &&
                            (domain.type === DomainTypes.CATEGORICAL || domain.type === DomainTypes.BOOLEAN)
                        ) {
                            requiredDataPoint.data.outputs.configuratorParameterValue = flatten(
                                result.configuratorParams.data
                            )[requiredDataPoint.id];
                        }
                        // for all parameters, update the performance delta to the x point
                        // as well as the slope, where applicable (where an xDelta exists)
                        if (xResult) {
                            if (requiredDataPoint.id !== "x") {
                                requiredDataPoint.data.outputs.performanceDelta =
                                    result.avgPerformance - xResult.avgPerformance;
                                if (requiredDataPoint.data.outputs.xDelta) {
                                    requiredDataPoint.data.outputs.slope =
                                        requiredDataPoint.data.outputs.performanceDelta /
                                        requiredDataPoint.data.outputs.xDelta;
                                }
                            }
                        }
                    }
                }
            }
            // check the completed flag to see if all required data point result convergence test
            // were completed; in this case, all results for the state have been fully calculated
            state.converged = false;
            if (completed) {
                state.status = States.COMPLETED;
                state.percentComplete = 100;
                state.end = new Date();
                state.durationSec = state.start ? (state.end.getTime() - state.start.getTime()) / 1000 : undefined;
                state.converged = this._testConvergence(state);
            } else if (running) {
                state.status = States.RUNNING;
            } else if (failed) {
                state.status = States.FAILED;
                state.percentComplete = undefined;
                throw new Error("Optimiser state update failed; one or more results failed");
            }
        } else {
            throw new Error("Invalid parameters for update; either provide a state and results or a simSet");
        }
        return state;
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
        simSetDTO?: SimSetDTO
    ): OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> {
        let newState: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>> = {} as OptimiserStateDTO<
            GradientAscentOptimiserData<C1ConfiguratorParamData>
        >;

        // check if this is the first simulation step
        if (init) {
            if (simSetDTO) {
                // this is the first step, so stepCount is zero;
                // initialise the first OptimisationStep
                newState = {
                    modelName: this.model.name,
                    optimiserName: this.name,
                    converged: false,
                    start: new Date(),
                    percentComplete: 0,
                    status: States.PENDING,
                    stepCount: 0,
                    simSet: simSetDTO,
                    optimiserData: {
                        // pick a random configuration within the configuration parameter space as the
                        // initial x data point
                        dataPoints: [this._getNewDataPoint("x", this._getRandomInit())]
                    }
                } as OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>;
            } else {
                throw new Error("Initialisation of Optimiser requires a simSetDTO");
            }
        }
        // this is not the first optimisation step
        else if (!init && state && state.status === States.COMPLETED) {
            // we are stepping out of an existing state, so copy the basic key variables from the existing
            // state object passed to this function
            newState = {
                stepCount: state.stepCount + 1,
                simSet: state.simSet,
                status: States.PENDING,
                converged: false,
                percentComplete: 0,
                modelName: state.modelName,
                optimiserName: state.optimiserName,
                optimiserData: {
                    dataPoints: []
                }
            };

            // copy the current x data point on which the new point will be based
            let xPrev: DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput> | undefined =
                state.optimiserData.dataPoints.find((dataPoint) => dataPoint.id === "x");
            if (xPrev) {
                // flatten the configurator parameters used for the x poimt for easy reference
                let currentXConfigFlat = flatten(JSON.parse(JSON.stringify(xPrev.data.inputs.data)));
                // copy the current x configurator parameters to a new object to use
                // for the new x that we are stepping to
                let newXConfigFlat = JSON.parse(JSON.stringify(currentXConfigFlat));

                // cycle through all parameters and, for the ones that we are optimising against,
                // proceed to calculate the next step
                for (const key in this._parameterDomains) {
                    const domain = this._parameterDomains[key];
                    if (domain.optimise) {
                        // get the value of the parameter to be optimised
                        let currentXResults = state.optimiserData.dataPoints.filter(
                            (dataPoint) => dataPoint.id === key
                        );
                        // establish the new value of x for the parameter to be optimised
                        if (currentXResults.length > 0) {
                            let maxPerformanceResult = currentXResults.sort((a, b) => {
                                if (a.data.outputs.performance && b.data.outputs.performance) {
                                    return a.data.outputs.performance - b.data.outputs.performance;
                                } else {
                                    return 0;
                                }
                            })[0];
                            if (domain.type === DomainTypes.CONTINUOUS || domain.type === DomainTypes.DISCRETE) {
                                if (maxPerformanceResult?.data?.outputs?.slope) {
                                    newXConfigFlat[key] = this._boundStep(
                                        currentXConfigFlat[key],
                                        maxPerformanceResult.data.outputs.slope,
                                        domain
                                    );
                                } else {
                                    newXConfigFlat[key] = this._boundStep(currentXConfigFlat[key], 0, domain);
                                }
                            }
                            if (domain.type === DomainTypes.BOOLEAN || domain.type === DomainTypes.CATEGORICAL) {
                                // for boolean and categorical domains we will use the parameter value with the highest performance
                                if (xPrev.data.outputs.performance) {
                                    if (
                                        maxPerformanceResult?.data?.outputs?.configuratorParameterValue &&
                                        maxPerformanceResult?.data?.outputs?.performance &&
                                        maxPerformanceResult.data.outputs.performance > xPrev.data.outputs.performance
                                    ) {
                                        newXConfigFlat[key] =
                                            maxPerformanceResult.data.outputs.configuratorParameterValue;
                                    }
                                }
                            }
                        }
                    }
                }
                newState.optimiserData.dataPoints.push(this._getNewDataPoint("x", flatten.unflatten(newXConfigFlat)));
            } else {
                throw new Error("Could not find data point for x");
            }
        }

        // finally, generate the gradient data points
        newState.optimiserData.dataPoints = [
            ...newState.optimiserData.dataPoints,
            ...this._getGradientPoints(newState.optimiserData.dataPoints[0])
        ];
        return newState;
    }

    private _getGradientPoints(
        x: DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>
    ): DataPoint<ConfiguratorParamsDTO<C1ConfiguratorParamData>, GradientAscentOutput>[] {
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
                let xPlusDxOutput: GradientAscentOutput = {} as GradientAscentOutput;
                // establish the xDelta and new value of x for the parameter to be optimised
                // first for the case of discrete, continuous and boolean domains
                if (
                    domain.type === DomainTypes.DISCRETE ||
                    domain.type === DomainTypes.CONTINUOUS ||
                    domain.type === DomainTypes.BOOLEAN
                ) {
                    let xConfiguratorNewValue;
                    let xDelta: number = 0;
                    let xPlusXDelta: number = 0;

                    // determine the new x
                    // for discrete and continuous domains
                    if (domain.type === DomainTypes.DISCRETE || domain.type === DomainTypes.CONTINUOUS) {
                        xPlusXDelta = xConfiguratorCurrentValue;
                        // if we have hit the domain bounds, step backwards so that we still get a slope estimate
                        // at the boundary.  xDelta will be a negative number
                        if (xConfiguratorCurrentValue < domain.max) {
                            xDelta = Math.min(domain.derivativeStepSize, domain.max - xConfiguratorCurrentValue);
                        } else {
                            xDelta = -Math.min(domain.derivativeStepSize, xConfiguratorCurrentValue - domain.min);
                        }
                        xPlusXDelta += xDelta;
                        xConfiguratorNewValue = xPlusXDelta;
                    }
                    // for boolean domains, just flip the flag of the input
                    if (domain.type === DomainTypes.BOOLEAN) {
                        xDelta = xConfiguratorCurrentValue ? -1 : 1;
                        xPlusXDelta += xDelta;
                        xConfiguratorNewValue = xPlusXDelta ? true : false;
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
                    del.push(this._getNewDataPoint(key, xPlusDxConfigParams, xPlusDxOutput));
                }
                // in categorical domains, we will need to get data points for each category in order to figure out
                // which to which category to move in the gradient ascent
                if (domain.type === DomainTypes.CATEGORICAL) {
                    let currentCategoryIndex = domain.categories.indexOf(xConfiguratorCurrentValue);
                    for (let i = 0; i < domain.categories.length; i++) {
                        if (i !== currentCategoryIndex) {
                            let xConfiguratorNewValue;
                            // establish the new value of x for the parameter to be optimised
                            xConfiguratorNewValue = domain.categories[i];
                            copyOfXConfigFlat[key] = xConfiguratorNewValue;
                            let xPlusDxConfigParams = flatten.unflatten(copyOfXConfigFlat);
                            // using the calculated values of the new x and xDelta, create a new data point
                            // that will be used to estimate the partial derivative along the optimisation dimension
                            // of the parameter key
                            xPlusDxOutput.configuratorParameterValue = xConfiguratorNewValue;
                            del.push(this._getNewDataPoint(key, xPlusDxConfigParams, xPlusDxOutput));
                        }
                    }
                }
            }
        }
        return del;
    }

    // test convergence by taking the modulo of the del
    private _testConvergence(state: OptimiserStateDTO<GradientAscentOptimiserData<C1ConfiguratorParamData>>): boolean {
        let modulo: number = 0;

        for (let dataPoint of state.optimiserData.dataPoints) {
            // for all parameters (exclude x)...
            if (dataPoint.id !== "x") {
                const domain = this._parameterDomains[dataPoint.id];
                if (domain && domain.optimise) {
                    // for the subset of parameters where we are performing optimisation, there will be components
                    // to the del
                    if (
                        (domain.type === DomainTypes.CONTINUOUS || domain.type === DomainTypes.DISCRETE) &&
                        dataPoint.data.outputs.slope
                    ) {
                        // for numerical domains, the contribution to the modulo of the del will be a straightforward
                        // square of the slope, unless the variable is at the domain maximum, in which case contribution
                        // will only be made if the slope is negative in which case the gradient ascent can proceed within the
                        // domain
                        if (!(dataPoint.data.outputs.xPlusDelta === domain.max && dataPoint.data.outputs.slope > 0))
                            modulo += dataPoint.data.outputs.slope ** 2;
                    } else if (
                        (domain.type === DomainTypes.BOOLEAN || domain.type === DomainTypes.CATEGORICAL) &&
                        dataPoint.data.outputs.performanceDelta
                    ) {
                        // for categorical and boolean domains, if the expected performance change is not positive,
                        // then there is no further scope for optimisation; therefore the contribution to the del is
                        // the expected performance change along the optimisation dimension, otherwise it is zero
                        // not taking a square here to avoid overflow due to hight numbers
                        if (dataPoint.data.outputs.performanceDelta > 0)
                            modulo += dataPoint.data.outputs.performanceDelta;
                    }
                } else {
                    throw new Error(
                        `Domain ${domain} not found or insufficient output data to test convergence for optimiser state id:${state.id}`
                    );
                }
            }
        }
        // take the square root of the modulo
        modulo = Math.sqrt(modulo);
        // check against the tolerance of the optimisation for convergence
        return modulo < this._parameters.iterations.tolerance;
    }

    protected _boundRandom(min: number, max: number): number {
        return Math.random() * (max - min) + min;
    }

    protected _boundStep(x: number, slope: number, domain: Domain): number {
        if (domain.type === DomainTypes.DISCRETE || domain.type === DomainTypes.CONTINUOUS) {
            let value: number = x + slope * this._parameters.iterations.learningRate;
            if (domain.type === DomainTypes.DISCRETE) {
                value = Math.round(value);
            }
            if (domain.optimise) {
                if (value < domain.min) return domain.min;
                if (value > domain.max) return domain.max;
            }
            return value;
        } else {
            throw new Error(`Bound step cannot be performed on a parameter that is not a number`);
        }
    }

    protected _validateConfiguratorParamData(configuratorParamData: C1ConfiguratorParamData): void {
        for (const key in this._parameterDomains) {
            const domain = this._parameterDomains[key];
            if (domain.optimise && domain.type !== DomainTypes.CATEGORICAL && domain.type !== DomainTypes.BOOLEAN) {
                // check that the parameter is within the range of the parameter space
                if (!this._checkRange(configuratorParamData[key], domain.min, domain.max))
                    throw new Error(`The parameter ${key} is out of range`);
            }
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
