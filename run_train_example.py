import os
import sys
import torch
import torch.distributed as dist

sys.path.insert(0, os.getcwd())

os.environ["TOKENIZERS_PARALLELISM"] = "false"
os.environ["WANDB__SERVICE_WAIT"] = "300"
os.environ["WANDB_API_KEY"] = "YOUR_WANDB_API_KEY"

from core.config import LanguageModelSAETrainingConfig
from core.runner import language_model_sae_runner

use_ddp = False

if use_ddp:
    dist.init_process_group(backend='nccl')
    torch.cuda.set_device(dist.get_rank())

cfg = LanguageModelSAETrainingConfig(
    # LanguageModelConfig
    model_name = "gpt2",                            # The model name or path for the pre-trained model.
    d_model = 768,                                  # The hidden size of the model.

    # TextDatasetConfig
    dataset_path = "data/openwebtext",              # The corpus name or path. Each of a data record should contain (and may only contain) a "text" field.
    is_dataset_tokenized = False,                   # Whether the dataset is tokenized.
    is_dataset_on_disk = True,                      # Whether the dataset is on disk. If not on disk, `datasets.load_dataset`` will be used to load the dataset, and the train split will be used for training.
    concat_tokens = False,                          # Whether to concatenate tokens into a single sequence. If False, only data record with length of non-padding tokens larger than `context_size` will be used.
    context_size = 256,                             # The sequence length of the text dataset.
    store_batch_size = 32,                          # The batch size for loading the corpus.

    # ActivationStoreConfig
    hook_point = f"blocks.9.hook_mlp_out",          # The hook point to extract the activations, i.e. the layer output of which is used for training/evaluating the dictionary.
    use_cached_activations = False,                 # Whether to use cached activations. Caching activation is now not recommended, as it may consume extremely large disk space. (May be tens of TBs for corpus like `openwebtext`)
    n_tokens_in_buffer = 500_000,                   # The number of tokens to store in the activation buffer. The buffer is used to shuffle the activations before training the dictionary.
    
    # SAEConfig
    use_decoder_bias = False,                       # Whether to use the decoder bias for the decoder.
    decoder_bias_init_method = "geometric_median",  # The method to initialize the decoder bias. Can be "geometric_median", "mean" or "zero".
    expansion_factor = 32,                          # The expansion factor of the dictionary. d_sae = expansion_factor * d_model.
    norm_activation = "token-wise",                 # The normalization method for the activations. Can be "token-wise", "batch-wise" or "none".
    decoder_exactly_unit_norm = False,              # Whether to enforce the decoder to have exactly unit norm. If False, the decoder will have less than or equal to unit norm.
    use_glu_encoder = False,                        # Whether to use the Gated Linear Unit (GLU) for the encoder.
    l1_coefficient = 1.2e-4,                        # The L1 regularization coefficient for the feature activations.
    lp = 1,                                         # The p-norm to use for the L1 regularization.
    use_ghost_grads = True,                         # Whether to use the ghost gradients for saving dead features.

    # LanguageModelSAETrainingConfig
    total_training_tokens = 2_000_000,          # The total number of tokens to train the dictionary.
    lr = 5e-4,                                      # The learning rate for the dictionary training.
    betas = (0, 0.9999),                            # The betas for the Adam optimizer.
    lr_scheduler_name = "constantwithwarmup",       # The learning rate scheduler name. Can be "constant", "constantwithwarmup", "linearwarmupdecay", "cosineannealing", "cosineannealingwarmup" or "exponentialwarmup".
    lr_warm_up_steps = 5000,                        # The number of warm-up steps for the learning rate.
    lr_cool_down_steps = 10000,                     # The number of cool-down steps for the learning rate. Currently only used for the "constantwithwarmup" scheduler.
    train_batch_size = 4096,                        # The batch size for training the dictionary, i.e. the number of token activations in a batch.
    feature_sampling_window = 1000,                 # The window size for sampling the feature activations.
    dead_feature_window = 5000,                     # The window size for detecting the dead features.
    dead_feature_threshold = 1e-6,                  # The threshold for detecting the dead features.
    eval_frequency = 1000,                          # The step frequency for evaluating the dictionary.
    log_frequency = 100,                            # The step frequency for logging the training information (to wandb).
    n_checkpoints = 10,                             # The number of checkpoints to save during the training.

    # WandbConfig
    log_to_wandb = True,                            # Whether to log the training information to wandb.
    wandb_project= "gpt2-sae",                      # The wandb project name.
    wandb_entity = "fnlp-mechinterp",               # The wandb entity name.
    
    # RunnerConfig
    use_ddp = use_ddp,                              # Whether to use the DistributedDataParallel.
    device = "cuda",                                # The device to place all torch tensors.
    seed = 42,                                      # The random seed.
    dtype = torch.float32,                          # The torch data type of non-integer tensors.

    exp_name = "test"                               # The experiment name. Would be used for creating exp folder (which may contain checkpoints and analysis results) and setting wandb run name. 
)

sparse_autoencoder = language_model_sae_runner(cfg)

if use_ddp:
    dist.destroy_process_group()