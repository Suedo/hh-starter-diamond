/* global describe it before ethers */

import {Contract, ContractFactory} from "ethers";
import {deployments, ethers, getNamedAccounts} from "hardhat";
import {
    DiamondSelectors,
    FacetCutAction,
    removeSelectors,
    findAddressPositionInFacets,
} from "../scripts/libraries/DIamondUtils";

import {DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet} from "../typechain-types/facets";
import {assert} from "chai";

describe("DiamondTest", async function () {
    let diamondAddress: string;
    let diamondCutFacet: DiamondCutFacet;
    let diamondLoupeFacet: DiamondLoupeFacet;
    let ownershipFacet: OwnershipFacet;
    let tx;
    let receipt;
    let result;
    let deployer;
    let accounts;
    const addresses: string[] = [];

    before(async function () {
        deployer = (await getNamedAccounts()).deployer;
        deployments.fixture(["Diamond"]);
        accounts = await ethers.getSigners();

        diamondAddress = (await ethers.getContract("Diamond", deployer)).address;
        diamondCutFacet = await ethers.getContract("DiamondCutFacet", deployer);
        diamondLoupeFacet = await ethers.getContract("DiamondLoupeFacet", deployer);
        ownershipFacet = await ethers.getContract("OwnershipFacet", deployer);
    });

    it("should have three facets -- call to facetAddresses function", async () => {
        for (const address of await diamondLoupeFacet.facetAddresses()) {
            addresses.push(address);
        }

        assert.equal(addresses.length, 3);
    });

    it("facets should have the right function selectors -- call to facetFunctionSelectors function", async () => {
        let selectors = new DiamondSelectors(diamondCutFacet).selectors();
        result = await diamondLoupeFacet.facetFunctionSelectors(addresses[0]);
        assert.sameMembers(result, selectors);
        selectors = new DiamondSelectors(diamondLoupeFacet).selectors();
        result = await diamondLoupeFacet.facetFunctionSelectors(addresses[1]);
        assert.sameMembers(result, selectors);
        selectors = new DiamondSelectors(ownershipFacet).selectors();
        result = await diamondLoupeFacet.facetFunctionSelectors(addresses[2]);
        assert.sameMembers(result, selectors);
    });

    it("selectors should be associated to facets correctly -- multiple calls to facetAddress function", async () => {
        assert.equal(addresses[0], await diamondLoupeFacet.facetAddress("0x1f931c1c"));
        assert.equal(addresses[1], await diamondLoupeFacet.facetAddress("0xcdffacc6"));
        assert.equal(addresses[1], await diamondLoupeFacet.facetAddress("0x01ffc9a7"));
        assert.equal(addresses[2], await diamondLoupeFacet.facetAddress("0xf2fde38b"));
    });

    it("should add test1 functions", async () => {
        const Test1Facet = await ethers.getContractFactory("Test1Facet");
        const test1Facet = await Test1Facet.deploy();
        await test1Facet.deployed();
        addresses.push(test1Facet.address);
        const selectors = new DiamondSelectors(test1Facet).remove(["supportsInterface(bytes4)"]).selectors();
        tx = await diamondCutFacet.diamondCut(
            [
                {
                    facetAddress: test1Facet.address,
                    action: FacetCutAction.Add,
                    functionSelectors: selectors,
                },
            ],
            ethers.constants.AddressZero,
            "0x",
            {gasLimit: 800000}
        );
        receipt = await tx.wait();
        if (!receipt.status) {
            throw Error(`Diamond upgrade failed: ${tx.hash}`);
        }
        result = await diamondLoupeFacet.facetFunctionSelectors(test1Facet.address);
        assert.sameMembers(result, selectors);
    });

    it("should test function call", async () => {
        const test1Facet = await ethers.getContractAt("Test1Facet", diamondAddress);
        await test1Facet.test1Func10();
    });

    it("should replace supportsInterface function", async () => {
        const Test1Facet = await ethers.getContractFactory("Test1Facet");
        const selectors = new DiamondSelectors(Test1Facet).get(["supportsInterface(bytes4)"]).selectors();
        const testFacetAddress = addresses[3];
        tx = await diamondCutFacet.diamondCut(
            [
                {
                    facetAddress: testFacetAddress,
                    action: FacetCutAction.Replace,
                    functionSelectors: selectors,
                },
            ],
            ethers.constants.AddressZero,
            "0x",
            {gasLimit: 800000}
        );
        receipt = await tx.wait();
        if (!receipt.status) {
            throw Error(`Diamond upgrade failed: ${tx.hash}`);
        }
        result = await diamondLoupeFacet.facetFunctionSelectors(testFacetAddress);
        assert.sameMembers(result, new DiamondSelectors(Test1Facet).selectors());
    });

    it("should add test2 functions", async () => {
        const Test2Facet = await ethers.getContractFactory("Test2Facet");
        const test2Facet = await Test2Facet.deploy();
        await test2Facet.deployed();
        addresses.push(test2Facet.address);
        const selectors = new DiamondSelectors(test2Facet).selectors();
        tx = await diamondCutFacet.diamondCut(
            [
                {
                    facetAddress: test2Facet.address,
                    action: FacetCutAction.Add,
                    functionSelectors: selectors,
                },
            ],
            ethers.constants.AddressZero,
            "0x",
            {gasLimit: 800000}
        );
        receipt = await tx.wait();
        if (!receipt.status) {
            throw Error(`Diamond upgrade failed: ${tx.hash}`);
        }
        result = await diamondLoupeFacet.facetFunctionSelectors(test2Facet.address);
        assert.sameMembers(result, selectors);
    });

    it("should remove some test2 functions", async () => {
        const test2Facet = await ethers.getContractAt("Test2Facet", diamondAddress);
        const functionsToKeep = ["test2Func1()", "test2Func5()", "test2Func6()", "test2Func19()", "test2Func20()"];
        const selectors = new DiamondSelectors(test2Facet).remove(functionsToKeep).selectors();
        tx = await diamondCutFacet.diamondCut(
            [
                {
                    facetAddress: ethers.constants.AddressZero,
                    action: FacetCutAction.Remove,
                    functionSelectors: selectors,
                },
            ],
            ethers.constants.AddressZero,
            "0x",
            {gasLimit: 800000}
        );
        receipt = await tx.wait();
        if (!receipt.status) {
            throw Error(`Diamond upgrade failed: ${tx.hash}`);
        }
        result = await diamondLoupeFacet.facetFunctionSelectors(addresses[4]);
        assert.sameMembers(result, new DiamondSelectors(test2Facet).get(functionsToKeep).selectors());
    });

    it("should remove some test1 functions", async () => {
        const test1Facet = await ethers.getContractAt("Test1Facet", diamondAddress);
        const functionsToKeep = ["test1Func2()", "test1Func11()", "test1Func12()"];
        const selectors = new DiamondSelectors(test1Facet).remove(functionsToKeep).selectors();
        tx = await diamondCutFacet.diamondCut(
            [
                {
                    facetAddress: ethers.constants.AddressZero,
                    action: FacetCutAction.Remove,
                    functionSelectors: selectors,
                },
            ],
            ethers.constants.AddressZero,
            "0x",
            {gasLimit: 800000}
        );
        receipt = await tx.wait();
        if (!receipt.status) {
            throw Error(`Diamond upgrade failed: ${tx.hash}`);
        }
        result = await diamondLoupeFacet.facetFunctionSelectors(addresses[3]);
        assert.sameMembers(result, new DiamondSelectors(test1Facet).get(functionsToKeep).selectors());
    });

    it("remove all functions and facets accept 'diamondCut' and 'facets'", async () => {
        let selectors = [];
        let facets = await diamondLoupeFacet.facets();
        for (let i = 0; i < facets.length; i++) {
            selectors.push(...facets[i].functionSelectors);
        }
        selectors = removeSelectors(selectors, [
            "facets()",
            "diamondCut(tuple(address,uint8,bytes4[])[],address,bytes)",
        ]);
        tx = await diamondCutFacet.diamondCut(
            [
                {
                    facetAddress: ethers.constants.AddressZero,
                    action: FacetCutAction.Remove,
                    functionSelectors: selectors,
                },
            ],
            ethers.constants.AddressZero,
            "0x",
            {gasLimit: 800000}
        );
        receipt = await tx.wait();
        if (!receipt.status) {
            throw Error(`Diamond upgrade failed: ${tx.hash}`);
        }
        facets = await diamondLoupeFacet.facets();
        assert.equal(facets.length, 2);
        assert.equal(facets[0][0], addresses[0]);
        assert.sameMembers(facets[0][1], ["0x1f931c1c"]);
        assert.equal(facets[1][0], addresses[1]);
        assert.sameMembers(facets[1][1], ["0x7a0ed627"]);
    });

    it("add most functions and facets", async () => {
        const diamondLoupeFacetSelectors = new DiamondSelectors(diamondLoupeFacet).remove([
            "supportsInterface(bytes4)",
        ]);
        const Test1Facet = await ethers.getContractFactory("Test1Facet");
        const Test2Facet = await ethers.getContractFactory("Test2Facet");
        // Any number of functions from any number of facets can be added/replaced/removed in a
        // single transaction
        const cut = [
            {
                facetAddress: addresses[1],
                action: FacetCutAction.Add,
                functionSelectors: diamondLoupeFacetSelectors.remove(["facets()"]).selectors(),
            },
            {
                facetAddress: addresses[2],
                action: FacetCutAction.Add,
                functionSelectors: new DiamondSelectors(ownershipFacet).selectors(),
            },
            {
                facetAddress: addresses[3],
                action: FacetCutAction.Add,
                functionSelectors: new DiamondSelectors(Test1Facet).selectors(),
            },
            {
                facetAddress: addresses[4],
                action: FacetCutAction.Add,
                functionSelectors: new DiamondSelectors(Test2Facet).selectors(),
            },
        ];
        tx = await diamondCutFacet.diamondCut(cut, ethers.constants.AddressZero, "0x", {gasLimit: 8000000});
        receipt = await tx.wait();
        if (!receipt.status) {
            throw Error(`Diamond upgrade failed: ${tx.hash}`);
        }
        const facets = await diamondLoupeFacet.facets();
        const facetAddresses = await diamondLoupeFacet.facetAddresses();
        assert.equal(facetAddresses.length, 5);
        assert.equal(facets.length, 5);
        assert.sameMembers(facetAddresses, addresses);
        assert.equal(facets[0][0], facetAddresses[0], "first facet");
        assert.equal(facets[1][0], facetAddresses[1], "second facet");
        assert.equal(facets[2][0], facetAddresses[2], "third facet");
        assert.equal(facets[3][0], facetAddresses[3], "fourth facet");
        assert.equal(facets[4][0], facetAddresses[4], "fifth facet");
        assert.sameMembers(
            facets[findAddressPositionInFacets(addresses[0], facets)][1],
            new DiamondSelectors(diamondCutFacet).selectors()
        );
        assert.sameMembers(facets[findAddressPositionInFacets(addresses[1], facets)][1], diamondLoupeFacetSelectors);
        assert.sameMembers(
            facets[findAddressPositionInFacets(addresses[2], facets)][1],
            new DiamondSelectors(ownershipFacet).selectors()
        );
        assert.sameMembers(
            facets[findAddressPositionInFacets(addresses[3], facets)][1],
            new DiamondSelectors(Test1Facet).selectors()
        );
        assert.sameMembers(
            facets[findAddressPositionInFacets(addresses[4], facets)][1],
            new DiamondSelectors(Test2Facet).selectors()
        );
    });
});
