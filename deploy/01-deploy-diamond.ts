import {network} from "hardhat";
import {HardhatRuntimeEnvironment} from "hardhat/types";
import {DiamondSelectors, FacetCutAction} from "../scripts/libraries/DIamondUtils";

module.exports = async (hre: HardhatRuntimeEnvironment) => {
    const {ethers, getNamedAccounts, deployments} = hre;
    const {deploy, log} = deployments;
    const {deployer} = await getNamedAccounts();
    const chainId = network.config.chainId || 31337;
    const deployArgs = {from: deployer, log: true, waitConfirmations: 1};

    log("-".repeat(80));
    log(`Deploying contracts to ${network.name} with chainId ${chainId}`);

    // deploy DiamondCutFacet
    const diamondCutFacet = await deploy("DiamondCutFacet", deployArgs);
    console.log("DiamondCutFacet deployed at:", diamondCutFacet.address);

    // deploy Diamond
    const diamond = await deploy("Diamond", {
        ...deployArgs,
        args: [deployer, diamondCutFacet.address],
    });
    console.log("Diamond deployed at:", diamond.address);

    // deploy DiamondInit
    // DiamondInit provides a function that is called when the diamond is upgraded to initialize state variables
    // Read about how the diamondCut function works here: https://eips.ethereum.org/EIPS/eip-2535#addingreplacingremoving-functions
    const diamondInitDeployResult = await deploy("DiamondInit", deployArgs);
    console.log("DiamondInit deployed at:", diamondInitDeployResult.address);

    // deploy Diamond facets
    const FacetNames = ["DiamondLoupeFacet", "OwnershipFacet"];
    console.log(`Deploying Diamond facets: ${FacetNames}`);
    const cut = [];
    for (const FacetName of FacetNames) {
        const Facet = await ethers.getContractFactory(FacetName);
        const facet = await Facet.deploy();
        await facet.deployed();
        const diamondSelectors = new DiamondSelectors(facet);
        console.log(`${FacetName} deployed: ${facet.address}`);
        cut.push({
            facetAddress: facet.address,
            action: FacetCutAction.Add,
            functionSelectors: diamondSelectors.selectors(),
        });
    }

    // upgrade diamond with facets
    console.log("");
    console.log("Diamond Cut:", cut);

    // since we explicitly deploy DiamondInit, hardhat ethers remembers it, and can fetch by just name
    const diamondInit = await ethers.getContract("DiamondInit");

    // since we do not explicitly deploy IDiamondCut, but know that it it is a part of Diamond,
    // we get it through the diamond address
    const diamondCut = await ethers.getContractAt("IDiamondCut", diamond.address);
    console.log(`DiamondInit contract address: ${diamondInit.address}`);

    /*
      After adding/replacing/removing functions the _calldata argument is executed with delegatecall on _init.
      This execution is done to initialize data or setup or remove anything needed or no longer needed after adding, 
      replacing and/or removing functions. 
      If the _init value is address(0) then _calldata execution is skipped.
    */
    let initFunctionCall = diamondInit.interface.encodeFunctionData("init");
    let tx = await diamondCut.diamondCut(cut, diamondInit.address, initFunctionCall);

    console.log("Diamond cut tx: ", tx.hash);
    let receipt = await tx.wait();
    if (!receipt.status) {
        throw Error(`Diamond upgrade failed: ${tx.hash}`);
    }
    console.log("Completed diamond cut");
    return diamond.address;
};

module.exports.tags = ["all", "diamond"];
