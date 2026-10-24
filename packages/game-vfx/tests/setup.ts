import { installPortableMath } from '@adatechnology/golden-tool'

// Math.pow changed its last bit between Node 22 and 24; the goldens must not depend on the Node that runs them.
installPortableMath()
