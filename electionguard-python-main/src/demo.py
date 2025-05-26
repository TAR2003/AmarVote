import os
from electionguard.election import CiphertextElectionContext
from electionguard.election_builder import ElectionBuilder
from electionguard.elgamal import ElGamalKeyPair, elgamal_keypair_from_secret
from electionguard.manifest import Manifest, InternalManifest

# Open an election manifest file
with open(os.path.join(some_path, "election-manifest.json"), "r") as manifest:
    string_representation = manifest.read()
    election_description = Manifest.from_json(string_representation)

# Create an election builder instance, and configure it for a single public-private keypair.
# in a real election, you would configure this for a group of guardians.  See Key Ceremony for more information.
builder = ElectionBuilder(
    number_of_guardians=1,  # since we will generate a single public-private keypair, we set this to 1
    quorum=1,  # since we will generate a single public-private keypair, we set this to 1
    description=election_description,
)

# Generate an ElGamal Keypair from a secret.  In a real election you would use the Key Ceremony instead.
some_secret_value: int = 12345
keypair: ElGamalKeyPair = elgamal_keypair_from_secret(some_secret_value)

builder.set_public_key(keypair.public_key)

# get an `InternalElectionDescription` and `CiphertextElectionContext`
# that are used for the remainder of the election.
(internal_manifest, context) = builder.build()