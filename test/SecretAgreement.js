const { ethers } = require("hardhat");
const { expect } = require("chai");

describe("SecretAgreement", function () {
  let secretAgreement;
  let signer1;
  let signer2;
  let signer3;

  beforeEach(async function () {
    const SecretAgreement = await ethers.getContractFactory("SecretAgreement");
    [signer1, signer2, signer3] = await ethers.getSigners();
    secretAgreement = await SecretAgreement.deploy();
    await secretAgreement.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should get address of deployed contract", async function () {
      expect(await secretAgreement.getAddress()).to.not.equal(0);
    });

    it("Should return undefined for party1 value when passed an unregistered hash", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));
      expect(await secretAgreement.agreements(secretHash).party1).to.equal(
        undefined
      );
    });
  });

  describe("Create Agreement", function () {
    it("should allow two parties to create an agreement and reveal the secret", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));

      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);

      // Party 1 & 2 agree to the secret
      await secretAgreement.connect(signer1).agreeToSecret(secretHash);
      await secretAgreement.connect(signer2).agreeToSecret(secretHash);

      // Party 2 reveals the secret
      const signature = await signMessage(secretHash, signer2);
      await secretAgreement
        .connect(signer2)
        .revealSecret(secretHash, "Secret Message", signature);

      // Check if the secret has been revealed and agreement is deleted
      const agreement = await secretAgreement
        .connect(signer1)
        .agreements(secretHash);

      // expect(agreement.isSecretRevealed).to.be.true;
      expect(agreement.party1).to.equal(
        "0x0000000000000000000000000000000000000000"
      );

      // Find the logs of the event for the secret revealed
      const agreementRevealedEvent = await secretAgreement.queryFilter(
        secretAgreement.filters.SecretRevealed()
      );
      expect(agreementRevealedEvent[0].args.secret).to.equal("Secret Message");
    });

    it("should revert if the agreement already exists", async function () {
      // Create unique secret hash
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("BLAHHHHHH"));

      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer3)
        .createAgreement(secretHash, signer2.address);

      // Party 1 tries to create the agreement again
      await expect(
        secretAgreement
          .connect(signer3)
          .createAgreement(secretHash, signer2.address)
      ).to.be.revertedWithCustomError;
    });

    it("should check party1 is correct", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));
      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);

      // Check if the agreement has been updated
      const agreement = await secretAgreement.agreements(secretHash);
      expect(agreement.party1).to.equal(signer1.address);
    });

    it("should check party2 is correct", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));

      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);

      // Check if the agreement has been updated
      const agreement = await secretAgreement.agreements(secretHash);
      expect(agreement.party2).to.equal(signer2.address);
    });

    it("should check isParty1Voted is false", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));
      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);
      const agreement = await secretAgreement.agreements(secretHash);
      //Party 1 has not voted yet
      expect(agreement.isParty1Voted).to.be.false;
    });

    it("should check isParty2Voted is false", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));
      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);
      const agreement = await secretAgreement.agreements(secretHash);
      //Party 2 has not voted yet
      expect(agreement.isParty2Voted).to.be.false;
    });
  });

  describe("Agree to Secret", function () {
    it("Should agree party1 to secret", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));

      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);

      // Party 2 agrees to the secret
      await secretAgreement.connect(signer1).agreeToSecret(secretHash);

      // Check if the agreement has been updated
      const agreement = await secretAgreement.agreements(secretHash);
      expect(agreement.party1).to.equal(signer1.address);
      expect(agreement.isParty1Voted).to.be.true;
    });

    it("Should agree party2 to secret", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));

      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);

      // Party 2 agrees to the secret
      await secretAgreement.connect(signer2).agreeToSecret(secretHash);

      // Check if the agreement has been updated
      const agreement = await secretAgreement.agreements(secretHash);
      expect(agreement.party2).to.equal(signer2.address);
      expect(agreement.isParty2Voted).to.be.true;
    });

    it("Should revert if the agreement does not exist", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));
      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("Wrong Hash"));
      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);
      // Party 2 agrees to the secret
      await expect(secretAgreement.connect(signer1).agreeToSecret(wrongHash)).to
        .be.revertedWithCustomError;
    });

    it("Should revert if the party has already agreed to the secret", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));
      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);
      // Party 2 agrees to the secret
      await secretAgreement.connect(signer1).agreeToSecret(secretHash);
      await expect(secretAgreement.connect(signer1).agreeToSecret(secretHash))
        .to.be.revertedWithCustomError;
    });

    it("Should revert if the party is not part of the agreement", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));
      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);
      // Party 3 tries to agree to the secret
      await expect(secretAgreement.connect(signer3).agreeToSecret(secretHash))
        .to.be.revertedWithCustomError;
    });
  });

  describe("Reveal Secret", function () {
    it("should prevent an unauthorized party from revealing the secret", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));

      // Party 1 creates the agreement
      await secretAgreement.createAgreement(secretHash, signer2.address);

      // Unauthorized party tries to reveal the secret
      const signature = await signMessage(secretHash, signer1);
      await expect(
        secretAgreement
          .connect(signer3)
          .revealSecret(secretHash, "bye friend", signature)
      ).to.be.revertedWithCustomError;
    });

    it("Should revert if both parties have not agreed to the secret", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));

      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);

      // Party 2 tries to reveal the secret
      const signature = await signMessage(secretHash, signer2);
      await expect(
        secretAgreement
          .connect(signer2)
          .revealSecret(secretHash, "Secret Message", signature)
      ).to.be.revertedWithCustomError;
    });

    it("Should revert if the secret has already been revealed", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));

      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);

      // Party 1 & 2 agree to the secret
      await secretAgreement.connect(signer1).agreeToSecret(secretHash);
      await secretAgreement.connect(signer2).agreeToSecret(secretHash);

      // Party 2 reveals the secret
      const signature = await signMessage(secretHash, signer2);
      await secretAgreement
        .connect(signer2)
        .revealSecret(secretHash, "Secret Message", signature);

      // Party 2 tries to reveal the secret again
      await expect(
        secretAgreement
          .connect(signer2)
          .revealSecret(secretHash, "Secret Message", signature)
      ).to.be.revertedWithCustomError;
    });

    it("Should revert if the signature is invalid", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));

      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);

      // Party 1 & 2 agree to the secret
      await secretAgreement.connect(signer1).agreeToSecret(secretHash);
      await secretAgreement.connect(signer2).agreeToSecret(secretHash);

      // Party 2 tries to reveal the secret with an invalid signature
      const signature = await signMessage(secretHash, signer1);
      await expect(
        secretAgreement
          .connect(signer2)
          .revealSecret(secretHash, "Secret Message", signature)
      ).to.be.revertedWithCustomError;
    });

    it("Should revert if the secret hash is invalid", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));
      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("Wrong Hash"));

      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);

      // Party 1 & 2 agree to the secret
      await secretAgreement.connect(signer1).agreeToSecret(secretHash);
      await secretAgreement.connect(signer2).agreeToSecret(secretHash);

      // Party 2 tries to reveal the secret with an invalid secret hash
      const signature = await signMessage(secretHash, signer2);
      await expect(
        secretAgreement
          .connect(signer2)
          .revealSecret(wrongHash, "Secret Message", signature)
      ).to.be.revertedWithCustomError;
    });

    it("should emit event after secret is revealed", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));
      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);

      // Party 1 & 2 agree to the secret
      await secretAgreement.connect(signer1).agreeToSecret(secretHash);
      await secretAgreement.connect(signer2).agreeToSecret(secretHash);

      // Party 2 reveals the secret
      const signature = await signMessage(secretHash, signer2);
      await secretAgreement
        .connect(signer2)
        .revealSecret(secretHash, "Secret Message", signature);

      // Check if the secret has been revealed and agreement is deleted
      const agreement = await secretAgreement
        .connect(signer1)
        .agreements(secretHash);

      // Find the logs of the event for the secret revealed
      const agreementRevealedEvent = await secretAgreement.queryFilter(
        secretAgreement.filters.SecretRevealed()
      );
      expect(agreementRevealedEvent[0].args.secret).to.equal("Secret Message");
    });
    it("should revert if signature was already used", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));
      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);

      // Party 1 & 2 agree to the secret
      await secretAgreement.connect(signer1).agreeToSecret(secretHash);
      await secretAgreement.connect(signer2).agreeToSecret(secretHash);

      // Party 2 reveals the secret
      const signature = await signMessage(secretHash, signer2);
      await secretAgreement
        .connect(signer2)
        .revealSecret(secretHash, "Secret Message", signature);

      // Party 2 tries to reveal the secret again
      await expect(
        secretAgreement
          .connect(signer2)
          .revealSecret(secretHash, "Secret Message", signature)
      ).to.be.revertedWithCustomError;
    });
    it("should set executed to true", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));
      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);

      // Party 1 & 2 agree to the secret
      await secretAgreement.connect(signer1).agreeToSecret(secretHash);
      await secretAgreement.connect(signer2).agreeToSecret(secretHash);

      // Party 2 reveals the secret
      const signature = await signMessage(secretHash, signer1);
      await secretAgreement
        .connect(signer2)
        .revealSecret(secretHash, "Secret Message", signature);

      const sigHash = ethers.keccak256(signature);

      expect(await secretAgreement.executedAgreements(sigHash)).to.be.true;
    });
    it("should revert if signature was already used", async function () {
      const secretHash = ethers.keccak256(ethers.toUtf8Bytes("Secret Message"));
      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash, signer2.address);

      // Party 1 & 2 agree to the secret
      await secretAgreement.connect(signer1).agreeToSecret(secretHash);
      await secretAgreement.connect(signer2).agreeToSecret(secretHash);

      // Party 2 reveals the secret
      const signature = await signMessage(secretHash, signer2);
      await secretAgreement
        .connect(signer2)
        .revealSecret(secretHash, "Secret Message", signature);
      //New secret is created
      const secretHash2 = ethers.keccak256(
        ethers.toUtf8Bytes("Secret Message2")
      );
      // Party 1 creates the agreement
      await secretAgreement
        .connect(signer1)
        .createAgreement(secretHash2, signer2.address);

      // Party 1 & 2 agree to the secret
      await secretAgreement.connect(signer1).agreeToSecret(secretHash2);
      await secretAgreement.connect(signer2).agreeToSecret(secretHash2);
      // Party 2 reveals the secret
      await expect(
        secretAgreement
          .connect(signer2)
          .revealSecret(secretHash2, "Secret Message2", signature)
      ).to.be.revertedWithCustomError;
    });
  });

  async function signMessage(message, signer) {
    const messageBytes = ethers.getBytes(message);
    const signature = await signer.signMessage(messageBytes);
    return signature;
  }
});
