<?php

namespace App\Exceptions;

use RuntimeException;

class InvalidGoogleTokenException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('Invalid Google token');
    }
}
